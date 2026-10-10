import assert from "node:assert/strict";
import {test} from "node:test";
import {deliverNextNewsletter, requestSubscription, changeSubscription, hashToken, newToken, newsletterMessage, normalizeEmail, validToken} from "./newsletterCore.mjs";

const now = new Date("2026-10-08T12:00:00Z");
const get = (doc, key) => key.split(".").reduce((value, part) => value?.[part], doc);
function matches(doc, query) {
  return Object.entries(query).every(([key, value]) => {
    if (key === "$or") return value.some((item) => matches(doc, item));
    const actual = get(doc, key);
    if (value && typeof value === "object" && !(value instanceof Date)) {
      return Object.entries(value).every(([op, operand]) => {
        if (op === "$exists") return (actual !== undefined) === operand;
        if (op === "$lte") return actual <= operand;
        if (op === "$gt") return actual > operand;
        if (op === "$lt") return actual < operand;
        if (op === "$ne") return actual !== operand;
        throw new Error(`Unsupported test operator ${op}`);
      });
    }
    return actual === value;
  });
}
function update(doc, changes, inserted = false) {
  for (const [operation, values] of Object.entries(changes)) for (const [key, value] of Object.entries(values)) {
    if (operation === "$setOnInsert" && !inserted) continue;
    const parts = key.split(".");
    let target = doc;
    for (const part of parts.slice(0, -1)) target = target[part] ||= {};
    const field = parts.at(-1);
    if (operation === "$unset") delete target[field];
    else if (operation === "$inc") target[field] = (target[field] || 0) + value;
    else target[field] = value;
  }
}
function fixture({subscribers, post} = {}) {
  const rows = {
    posts: [{_id: "post", status: "published", slug: "hello", title: "Hello", newsletter: {startedAt: now, availableAt: now}, ...post}],
    newsletter_subscribers: subscribers || [{_id: "a", email: "a@example.com", language: "de", status: "active", confirmedAt: new Date(+now - 1000), unsubscribeToken: newToken()}],
    newsletter_failures: [],
    newsletter_rate_limits: [],
  };
  const db = {collection: (name) => ({
    async findOne(query, options = {}) {
      const result = rows[name].filter((doc) => matches(doc, query));
      if (options.sort) result.sort((a, b) => a._id.localeCompare(b._id));
      return structuredClone(result[0] || null);
    },
    async findOneAndUpdate(query, changes, options = {}) {
      let doc = rows[name].find((doc) => matches(doc, query));
      const inserted = !doc;
      if (!doc && options.upsert) { doc = {...query}; rows[name].push(doc); }
      if (!doc) return null;
      update(doc, changes, inserted);
      return structuredClone(doc);
    },
    async updateOne(query, changes, options = {}) {
      let doc = rows[name].find((doc) => matches(doc, query));
      const inserted = !doc;
      if (!doc && options.upsert) { doc = {...query}; rows[name].push(doc); }
      if (doc) update(doc, changes, inserted);
      return {matchedCount: doc ? 1 : 0, modifiedCount: doc ? 1 : 0};
    },
  })};
  const sent = [];
  const args = {db, now, origin: "https://example.com", localize: (post) => post, send: async (message) => {sent.push(message); return {ok: true}; }};
  return {rows, sent, args};
}

test("normalizes addresses and rejects header/recipient injection", () => {
  assert.equal(normalizeEmail(" Reader@Example.com "), "reader@example.com");
  for (const email of [null, {}, "a@example.com,b@example.com", "a@example.com\r\nBcc:b@example.com", "bad", "x".repeat(255) + "@example.com"]) assert.equal(normalizeEmail(email), "");
});
test("tokens are unguessable and confirmation hashes do not expose the token", () => {
  const token = newToken();
  assert.ok(validToken(token));
  assert.notEqual(token, newToken());
  assert.notEqual(hashToken(token), token);
  assert.ok(!validToken({}));
  assert.ok(!validToken("short"));
});
test("escapes article content in HTML and provides localized unsubscribe and text", () => {
  const result = newsletterMessage({language: "de", title: '<img src=x>\r\nBcc: no', summary: "<script>bad</script>", url: "https://example.com/?a=1&b=2", unsubscribeUrl: "https://example.com/unsubscribe"});
  assert.doesNotMatch(result.html, /<img|<script>/);
  assert.doesNotMatch(result.subject, /[\r\n]/);
  assert.match(result.text, /Newsletter abbestellen/);
  assert.match(result.html, /&amp;/);
});
test("sends once per subscriber and does not restart completed campaigns", async () => {
  const {args, sent, rows} = fixture();
  assert.deepEqual(await deliverNextNewsletter(args), {sent: true});
  assert.equal(sent[0].to, "a@example.com");
  assert.match(sent[0].text, /lng=de/);
  assert.deepEqual(await deliverNextNewsletter(args), {completed: true});
  rows.posts[0].title = "Edited";
  assert.deepEqual(await deliverNextNewsletter(args), {idle: true});
  assert.equal(sent.length, 1);
});
test("overlapping workers claim a campaign only once", async () => {
  const {args, sent} = fixture();
  await Promise.all([deliverNextNewsletter(args), deliverNextNewsletter(args)]);
  assert.equal(sent.length, 1);
});
test("pending, unsubscribed and newly confirmed subscribers are excluded", async () => {
  const subscribers = [
    {_id: "a", status: "pending", confirmedAt: new Date(+now - 100)},
    {_id: "b", status: "unsubscribed", confirmedAt: new Date(+now - 100)},
    {_id: "c", status: "active", confirmedAt: new Date(+now + 100)},
  ];
  const {args, sent} = fixture({subscribers});
  assert.deepEqual(await deliverNextNewsletter(args), {completed: true});
  assert.equal(sent.length, 0);
});
test("drafts and historical articles do not send", async () => {
  for (const post of [{status: "draft"}, {newsletter: undefined}, {newsletter: {skipped: true}}]) {
    const {args, sent} = fixture({post});
    assert.deepEqual(await deliverNextNewsletter(args), {idle: true});
    assert.equal(sent.length, 0);
  }
});
test("failed SMTP retries with backoff and skips after five failures", async () => {
  const {args, rows} = fixture();
  args.send = async () => ({ok: false});
  for (let attempt = 1; attempt <= 5; attempt++) {
    assert.deepEqual(await deliverNextNewsletter(args), {failed: true});
    assert.deepEqual(await deliverNextNewsletter(args), {idle: true});
    args.now = new Date(+args.now + 5 * 60000);
  }
  assert.equal(rows.newsletter_failures.length, 1);
  assert.equal(rows.posts[0].newsletter.cursor, "a");
  assert.deepEqual(await deliverNextNewsletter(args), {completed: true});
});
test("an expired worker lease allows recovery", async () => {
  const {args, sent} = fixture({post: {newsletter: {startedAt: now, lock: "old", availableAt: new Date(+now - 1)}}});
  await deliverNextNewsletter(args);
  assert.equal(sent.length, 1);
});


test("signup requires consent, remains pending until confirmed, and supports unsubscribe", async () => {
  const {args, rows, sent} = fixture({subscribers: []});
  const input = {email: "Reader@Example.com", language: "de", consent: true};
  assert.equal((await requestSubscription({...args, input: {...input, consent: false}, ip: "test"})).status, 400);
  assert.equal(rows.newsletter_subscribers.length, 0);
  assert.equal((await requestSubscription({...args, input, ip: "test"})).status, 200);
  const subscriber = rows.newsletter_subscribers[0];
  assert.equal(subscriber.status, "pending");
  assert.equal(subscriber.email, "reader@example.com");
  const token = sent[0].text.match(/token=([a-f0-9]+)/)[1];
  assert.notEqual(subscriber.confirmationHash, token);
  assert.ok(await changeSubscription({db: args.db, now, action: "confirm", token}));
  assert.equal(subscriber.status, "active");
  assert.equal(subscriber.expiresAt, undefined);
  assert.equal(await changeSubscription({db: args.db, now, action: "confirm", token}), false);
  await requestSubscription({...args, input, ip: "test"});
  assert.equal(sent.length, 1, "active subscriber is not sent another confirmation");
  assert.ok(await changeSubscription({db: args.db, now, action: "unsubscribe", token: subscriber.unsubscribeToken}));
  assert.equal(subscriber.status, "unsubscribed");
  assert.ok(subscriber.expiresAt > now);
});
test("expired confirmation cannot activate a subscription and resend is throttled", async () => {
  const {args, rows, sent} = fixture({subscribers: []});
  const request = {...args, input: {email: "reader@example.com", consent: true}, ip: "test"};
  await requestSubscription(request);
  await requestSubscription(request);
  assert.equal(sent.length, 1);
  const token = sent[0].text.match(/token=([a-f0-9]+)/)[1];
  assert.equal(await changeSubscription({db: args.db, now: new Date(+now + 86400001), action: "confirm", token}), false);
  assert.equal(rows.newsletter_subscribers[0].status, "pending");
  await requestSubscription({...request, now: new Date(+now + 16 * 60000)});
  assert.equal(sent.length, 2);
  assert.equal(await changeSubscription({db: args.db, now, action: "confirm", token}), false);
});
test("confirmation mail failures can be retried and signup abuse is limited", async () => {
  const {args, sent} = fixture({subscribers: []});
  const request = {...args, input: {email: "reader@example.com", consent: true}, ip: "test"};
  assert.equal((await requestSubscription({...request, send: async () => {throw Error("SMTP");}})).status, 503);
  await requestSubscription(request);
  assert.equal(sent.length, 1);
  for (let i = 0; i < 8; i++) await requestSubscription(request);
  assert.equal((await requestSubscription(request)).status, 429);
});
