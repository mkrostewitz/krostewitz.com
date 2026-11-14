import test from "node:test";
import assert from "node:assert/strict";
import {apolloQueuePatch, dueApolloSync, runApolloSync, apolloSchedulerToken, validApolloSchedulerToken} from "./apolloSyncQueue.mjs";

const id = "507f1f77bcf86cd799439011";
const date = new Date("2026-11-02T12:00:00Z");
const get = (doc, key) => key.split(".").reduce((value, part) => value?.[part], doc);
function matches(doc, query) {
  return Object.entries(query).every(([key, expected]) => {
    if (key === "$and") return expected.every((item) => matches(doc, item));
    if (key === "$or") return expected.some((item) => matches(doc, item));
    const actual = get(doc, key);
    if (expected && typeof expected === "object" && !(expected instanceof Date)) return Object.entries(expected).every(([op, value]) => {
      if (op === "$exists") return (actual !== undefined) === value;
      if (op === "$lt") return actual < value;
      if (op === "$lte") return actual <= value;
      if (op === "$type") return typeof actual === value;
      if (op === "$in") return value.includes(actual);
      throw new Error(`Unsupported operator: ${op}`);
    });
    return actual === expected;
  });
}
function apply(doc, patch) {
  for (const [key, value] of Object.entries(patch.$set || {})) {
    const parts = key.split("."), last = parts.pop();
    let target = doc;
    for (const part of parts) target = target[part] ||= {};
    target[last] = value;
  }
  for (const key of Object.keys(patch.$unset || {})) delete doc[key];
}
function collection() {
  const doc = {_id: id, contact: {firstName: "Test", email: "new@example.com"}, leadTypes: ["Recruiter"], apollo: {contactId: id}};
  apply(doc, {$set: apolloQueuePatch(date)});
  return {doc,
    async findOneAndUpdate(filter, patch) {if (!matches(doc, filter)) return null; apply(doc, patch); return structuredClone(doc);},
    async updateOne(filter, patch) {if (!matches(doc, filter)) return {matchedCount: 0}; apply(doc, patch); return {matchedCount: 1};},
  };
}
const success = {contactId: id, detailsUpdated: true, labelsAdded: true, message: "Updated"};
const run = (leads, send, options = {}) => runApolloSync({leads, filter: dueApolloSync(date), background: true, now: () => date, send, ...options});

test("queued updates use stored identity and never enroll, even with enroll requested", async () => {
  const leads = collection();
  await run(leads, async (args) => {
    assert.equal(args.contactId, id);
    assert.equal(args.enroll, false);
    assert.equal(args.contact.email, "new@example.com");
    assert.deepEqual(args.categories, ["Recruiter"]);
    await args.onContactLinked(id);
    return success;
  }, {enroll: true});
  assert.equal(leads.doc.apollo.status, "synced");
  assert.equal(leads.doc.apollo.lastSyncedAt, date.toISOString());
  assert.equal(leads.doc.apolloSyncLock, undefined);
});

test("overlapping workers cannot send the same snapshot twice", async () => {
  const leads = collection();
  await run(leads, async () => {
    assert.equal(await run(leads, () => assert.fail("duplicate sync")), null);
    return success;
  });
});

test("saving during an in-flight sync leaves the newer changes queued", async () => {
  const leads = collection();
  await run(leads, async () => {
    apply(leads.doc, {$set: {...apolloQueuePatch(date), "contact.email": "latest@example.com"}});
    return success;
  });
  assert.equal(leads.doc.apollo.status, "pending");
  assert.equal(leads.doc.apollo.lastSyncedAt, undefined);
  await run(leads, async (args) => {assert.equal(args.contact.email, "latest@example.com"); return success;});
  assert.equal(leads.doc.apollo.status, "synced");
});

test("transient failures back off, respect due time, and stop after five attempts", async () => {
  const leads = collection();
  const fail = async () => ({contactId: id, retryable: true, message: "Timeout"});
  await run(leads, fail);
  assert.equal(leads.doc.apollo.status, "retrying");
  assert.equal(leads.doc.apollo.nextAttemptAt.getTime(), date.getTime() + 60000);
  assert.equal(await run(leads, () => assert.fail("too early")), null);
  leads.doc.apollo.attempts = 4;
  leads.doc.apollo.nextAttemptAt = date;
  await run(leads, fail);
  assert.equal(leads.doc.apollo.status, "error");
});

test("permanent permission errors do not retry or remove the saved contact link", async () => {
  const leads = collection();
  await run(leads, async () => ({contactId: id, retryable: false, message: "Permission denied"}));
  assert.equal(leads.doc.apollo.status, "error");
  assert.equal(leads.doc.apollo.contactId, id);
});

test("an interrupted worker is recovered after its lease expires", async () => {
  const leads = collection();
  leads.doc.apollo.status = "syncing";
  leads.doc.apolloSyncUntil = new Date(date.getTime() - 1);
  leads.doc.apolloSyncLock = "expired";
  await run(leads, async () => success);
  assert.equal(leads.doc.apollo.status, "synced");
});

test("an ambiguous manual enrollment is never automatically replayed", async () => {
  const leads = collection();
  await run(leads, async () => ({contactId: id, retryable: true, message: "Timeout"}), {background: false, enroll: true});
  assert.equal(leads.doc.apollo.status, "error");
});

test("scheduler requires a scoped token and fails closed without a secret", () => {
  const token = apolloSchedulerToken("test-secret");
  assert.notEqual(token, "test-secret");
  assert.equal(validApolloSchedulerToken(`Bearer ${token}`, "test-secret"), true);
  assert.equal(validApolloSchedulerToken(`Bearer ${token}`, "wrong"), false);
  assert.equal(validApolloSchedulerToken("Bearer ", ""), false);
  assert.equal(validApolloSchedulerToken(null, "test-secret"), false);
});

test("custom sequence selection reaches manual enrollment but never background sync", async () => {
  const sequenceId = "507f1f77bcf86cd799439099";
  for (const background of [true, false]) {
    await run(collection(), async (args) => {
      assert.equal(args.enroll, !background);
      assert.equal(args.sequenceId, background ? "" : sequenceId);
      return success;
    }, {background, enroll: true, sequenceId});
  }
});

test("enrollment outcome survives background sync and invalidates cached progress", async () => {
  const leads = collection();
  const sequenceId = "507f1f77bcf86cd799439099";
  await run(leads, async () => ({...success, sequenceId, sequenceStatus: "unknown", message: "Check enrollment"}), {background: false, enroll: true, sequenceId});
  assert.equal(leads.doc.apollo.lastEnrollment.sequenceId, sequenceId);
  assert.equal(leads.doc.apollo.lastEnrollment.status, "unknown");
  assert.equal(leads.doc.apollo.progressAttemptAt, null);
  const attempt = structuredClone(leads.doc.apollo.lastEnrollment);
  apply(leads.doc, {$set: apolloQueuePatch(date)});
  await run(leads, async () => success);
  assert.deepEqual(leads.doc.apollo.lastEnrollment, attempt);
});

test('background sync carries the explicit contact language and legacy language fallback', async () => {
  for (const explicit of [undefined, 'en', 'de']) {
    const leads = collection();
    leads.doc.language = 'de';
    if (explicit) leads.doc.contact.language = explicit;
    await run(leads, async args => {
      assert.equal(args.language, explicit || 'de');
      return success;
    });
  }
});
