import test from "node:test";
import assert from "node:assert/strict";
import {parseApolloJson, normalizeApolloPhones, pollApolloPhone} from "./apolloPhone.mjs";
import {enrichWithApollo} from "./apolloEnrichment.mjs";
const personId = "507f1f77bcf86cd799439011";
const requestId = "-1039995589705121900";

test("request IDs preserve all 64 bits, including negative values", () => {
  assert.equal(parseApolloJson(`{"request_id":${requestId}}`).request_id, requestId);
  assert.equal(parseApolloJson(`{"request_id":"${requestId}"}`).request_id, requestId);
});
test("phone lookup is explicitly requested with polling and without waterfall", async () => {
  const result = await enrichWithApollo({contact: {linkedinUrl: "linkedin.com/in/example"}, apiKey: "test", includePhone: true, fetchImpl: async (_url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.reveal_phone_number, true);
    assert.equal(body.poll_only, true);
    assert.equal(body.run_waterfall_phone, false);
    assert.equal(body.webhook_url, undefined);
    return {ok: true, text: async () => `{"person":{"id":"${personId}"},"request_id":${requestId}}`};
  }});
  assert.equal(result.phoneRequestId, requestId);
  assert.equal(result.phonePersonId, personId);
});
test("phone values are validated, deduplicated and retain type and DNC metadata", () => {
  const item = {sanitized_number: "+49123456789", type_cd: "mobile", status_cd: "valid_number", dnc_status_cd: "not_found"};
  const values = normalizeApolloPhones({phone_numbers: [item, item, null, {raw_number: "hidden"}]});
  assert.equal(values.length, 1);
  assert.equal(values[0].type, "mobile");
  assert.equal(values[0].doNotCall, "not found");
});
test("pending polling respects delay; terminal errors and mismatched people do not return numbers", async () => {
  const run = (response) => pollApolloPhone({requestId, personId, apiKey: "test", fetchImpl: async (url) => {assert.ok(url.endsWith(requestId)); return response;}});
  assert.deepEqual(await run({status: 404, ok: false, json: async () => ({error_code: "result_pending", retry_after_seconds: 25})}), {pending: true, retryAfter: 25});
  await assert.rejects(run({status: 404, ok: false, json: async () => ({error_code: "request_id_unknown"})}), /unavailable or expired/);
  await assert.rejects(run({status: 403, ok: false, json: async () => ({})}), /webhook_result\/show/);
  await assert.rejects(run({ok: true, json: async () => ({request_type: "phone", webhook_result: {people: [{id: "other", phone_numbers: [{raw_number: "+49123456789"}]}]}})}), /requested person/);
});

test('phone polling distinguishes processing, failure, empty completion, and available numbers', async () => {
  const run = payload => pollApolloPhone({requestId, personId, apiKey: 'test', fetchImpl: async () => ({ok: true, json: async () => ({request_type: 'phone', webhook_result: payload})})});
  for (const status of ['pending', 'processing', 'queued']) assert.deepEqual(await run({people: [{id: personId, status}]}), {pending: true, retryAfter: 10});
  await assert.rejects(run({status: 'failed', people: []}), /could not complete/);
  await assert.rejects(run({people: [{id: personId, status: 'failed'}]}), /could not complete/);
  assert.deepEqual(await run({people: [{id: personId, status: 'success', phone_numbers: []}]}), {pending: false, phones: []});
  const result = await run({people: [{id: personId, status: 'success', phone_numbers: [{sanitized_number: '+49123456789', type_cd: 'mobile'}]}]});
  assert.equal(result.pending, false);
  assert.equal(result.phones[0].number, '+49123456789');
});
