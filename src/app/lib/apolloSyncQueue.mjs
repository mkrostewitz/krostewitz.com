import {randomUUID, createHmac, timingSafeEqual} from "node:crypto";
import {getLeadTypes} from "./leadTypes.mjs";

export function apolloSchedulerToken(secret) {
  return secret ? createHmac("sha256", secret).update("apollo-sync-scheduler:v1").digest("hex") : "";
}
export function validApolloSchedulerToken(header, secret) {
  const token = apolloSchedulerToken(secret);
  const actual = Buffer.from(header || "");
  const expected = Buffer.from(`Bearer ${token}`);
  return Boolean(token && actual.length === expected.length && timingSafeEqual(actual, expected));
}

export function apolloQueuePatch(now = new Date()) {
  return {"apollo.status": "pending", "apollo.requestId": randomUUID(), "apollo.attempts": 0,
    "apollo.nextAttemptAt": now, "apollo.message": "Apollo update queued in the background."};
}

export function dueApolloSync(now = new Date()) {
  return {"apollo.contactId": {$type: "string"}, "apollo.status": {$in: ["pending", "retrying", "syncing"]},
    "apollo.nextAttemptAt": {$lte: now},
    $or: [{apolloSyncUntil: {$exists: false}}, {apolloSyncUntil: {$lt: now}}]};
}

// Both manual actions and background workers use the same lease. A request ID prevents
// a worker finishing an old snapshot from acknowledging more recent saved changes.
export async function runApolloSync({leads, filter, send, enroll = false, sequenceId = "", background = false, now = () => new Date()}) {
  const lockId = randomUUID();
  const started = now();
  const locked = await leads.findOneAndUpdate({$and: [filter, {$or: [
    {apolloSyncUntil: {$exists: false}}, {apolloSyncUntil: {$lt: started}},
  ]}]}, {$set: {apolloSyncLock: lockId, apolloSyncUntil: new Date(started.getTime() + 120000)}}, {returnDocument: "after"});
  if (!locked) return null;
  const revision = locked.apollo?.requestId;
  const owned = {_id: locked._id, apolloSyncLock: lockId};
  const snapshot = {...owned, "apollo.requestId": revision ?? {$exists: false}};
  const attempts = (locked.apollo?.attempts || 0) + 1;
  try {
    await leads.updateOne(snapshot, {$set: {"apollo.status": "syncing", "apollo.attempts": attempts}});
    let result;
    try {
      result = await send({contact: locked.contact, categories: getLeadTypes(locked), contactId: locked.apollo?.contactId,
        enroll: background ? false : enroll,
        sequenceId: background || !enroll ? "" : sequenceId,
        onContactLinked: async (contactId) => {
          const saved = await leads.updateOne(owned, {$set: {"apollo.contactId": contactId}});
          if (!saved.matchedCount) throw new Error("The lead was removed or its sync lease expired.");
        }});
    } catch (error) {
      result = {contactId: locked.apollo?.contactId, message: error.message || "Apollo sync failed.", retryable: error.retryable === true};
    }
    const finished = now();
    const success = Boolean(result.detailsUpdated && result.labelsAdded);
    // Never retry creation or sequence enrollment automatically.
    const retry = !success && result.retryable && (background || !enroll) && Boolean(result.contactId) && attempts < 5;
    const patch = {
      "apollo.status": success ? "synced" : retry ? "retrying" : "error",
      "apollo.message": result.message,
      "apollo.lastAttemptAt": finished.toISOString(),
      ...(success ? {"apollo.lastSyncedAt": finished.toISOString()} : {}),
      ...(retry ? {"apollo.nextAttemptAt": new Date(finished.getTime() + Math.min(60 * 2 ** (attempts - 1), 900) * 1000)} : {}),
    };
    if (!background && enroll && result.sequenceId) {
      await leads.updateOne(owned, {$set: {"apollo.lastEnrollment": {
        sequenceId: result.sequenceId, status: result.sequenceStatus || "unknown", message: result.message, attemptedAt: finished.toISOString(),
      }, "apollo.progressAttemptAt": null}});
    }
    await leads.updateOne(snapshot, {$set: patch});
    return result;
  } finally {
    await leads.updateOne(owned, {$unset: {apolloSyncLock: "", apolloSyncUntil: ""}});
  }
}
