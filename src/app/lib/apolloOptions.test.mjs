import test from "node:test";
import assert from "node:assert/strict";
import {getApolloOptions} from "./apolloOptions.mjs";
const id = "507f1f77bcf86cd799439011";

test("sequence options use paginated search and expose only dropdown metadata", async () => {
  const result = await getApolloOptions({kind: "sequences", page: 2, apiKey: "test-key", fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.apollo.io/api/v1/emailer_campaigns/search?page=2&per_page=100");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Api-Key"], "test-key");
    assert.equal(options.cache, "no-store");
    return {ok: true, json: async () => ({emailer_campaigns: [{id, name: "Website follow-up", active: false, archived: false, secret: "private"}], pagination: {total_pages: 3}})};
  }});
  assert.deepEqual(result, {options: [{id, label: "Website follow-up", disabled: false, status: "Inactive"}], nextPage: 3});
});

test("email account responses never forward credentials, signatures or unrelated metadata", async () => {
  const result = await getApolloOptions({kind: "accounts", apiKey: "test", fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.apollo.io/api/v1/email_accounts");
    assert.equal(options.method, "GET");
    return {ok: true, json: async () => ({email_accounts: [{id, email: "sender@example.com", active: true, sendgrid_api_key_v3: "secret", signature_html: "private"}]})};
  }});
  assert.deepEqual(result, {options: [{id, label: "sender@example.com", disabled: false, status: "Connected"}], nextPage: null});
});

test("unavailable choices are marked, malformed entries omitted, and empty pages are supported", async () => {
  const sequences = await getApolloOptions({kind: "sequences", apiKey: "test", fetchImpl: async () => ({ok: true, json: async () => ({emailer_campaigns: [null, {id: "invalid"}, {id, archived: true, name: "Old"}], pagination: {total_pages: 1}})})});
  assert.equal(sequences.options.length, 1);
  assert.equal(sequences.options[0].disabled, true);
  assert.equal(sequences.nextPage, null);
  const accounts = await getApolloOptions({kind: "accounts", apiKey: "test", fetchImpl: async () => ({ok: true, json: async () => ({email_accounts: [{id, active: true, revoked_at: "2026-01-01"}]})})});
  assert.equal(accounts.options[0].disabled, true);
  assert.deepEqual(await getApolloOptions({kind: "accounts", apiKey: "test", fetchImpl: async () => ({ok: true, json: async () => ({email_accounts: []})})}), {options: [], nextPage: null});
});

test("permission errors identify the required scope without forwarding provider secrets", async () => {
  for (const [kind, permission] of [["sequences", "emailer_campaigns/search"], ["accounts", "email_accounts/index"]]) {
    await assert.rejects(getApolloOptions({kind, apiKey: "test", fetchImpl: async () => ({ok: false, status: 403, json: async () => assert.fail("Must not expose response")})}), (error) => error.message.includes(permission));
  }
  await assert.rejects(getApolloOptions({kind: "accounts", fetchImpl: async () => {throw new Error("secret");}}), /Unable to reach/);
  await assert.rejects(getApolloOptions({kind: "accounts", fetchImpl: async () => ({ok: false, status: 429})}), {status: 429});
  await assert.rejects(getApolloOptions({kind: "accounts", fetchImpl: async () => ({ok: true, json: async () => ({})})}), /unexpected/);
  for (const args of [{kind: "unknown"}, {kind: "sequences", page: 0}, {kind: "sequences", page: 1.2}]) {
    await assert.rejects(getApolloOptions({...args, fetchImpl: async () => assert.fail("Must not fetch")}), {status: 400});
  }
});
