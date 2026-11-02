import test from "node:test";
import assert from "node:assert/strict";
import {getApolloProgress, normalizeApolloProgress} from "./apolloProgress.mjs";
const id = "507f1f77bcf86cd799439011";
const sequenceId = "507f1f77bcf86cd799439012";
const contact = {id, contact_stage_id: "stage", contact_campaign_statuses: [{emailer_campaign_id: sequenceId, status: "paused", current_step_id: "step", inactive_reason: "manual_pause"}]};
const campaign = {id: sequenceId, name: "Electronica", emailer_steps: [{id: "step", position: 2, type: "linkedin_step_message"}]};

test("progress resolves membership, stage and step without exposing contact data", async () => {
  const calls = [];
  const progress = await getApolloProgress({contactId: id, apiKey: "test", fetchImpl: async (url, options) => {
    calls.push({url, method: options.method});
    return {ok: true, json: async () => url.includes("contacts/") ? {contact: {...contact, email: "private@example.com"}} : url.includes("contact_stages") ? {contact_stages: [{id: "stage", name: "Approaching"}]} : {emailer_campaigns: [campaign], pagination: {total_pages: 1}}};
  }});
  assert.equal(progress.stageName, "Approaching");
  assert.equal(progress.sequences[0].name, "Electronica");
  assert.equal(progress.sequences[0].status, "paused");
  assert.equal(progress.sequences[0].stepNumber, 2);
  assert.equal(progress.sequences[0].reason, "manual_pause");
  assert.equal(progress.email, undefined);
  assert.equal(calls.length, 3);
  assert.ok(calls.every(call => call.method === "GET" || call.url.includes("/search?")));
});

test("confirmed empty memberships differ from missing response fields", () => {
  assert.equal(normalizeApolloProgress({contact_campaign_statuses: []}).membershipsKnown, true);
  assert.equal(normalizeApolloProgress({}).membershipsKnown, false);
  const partial = normalizeApolloProgress({emailer_campaign_ids: [sequenceId]});
  assert.equal(partial.sequences[0].status, "unknown");
  assert.equal(partial.sequences[0].stepNumber, null);
});

test("metadata permission errors preserve membership and expose actionable warnings", async () => {
  const progress = await getApolloProgress({contactId: id, fetchImpl: async url => url.includes("contacts/")
    ? {ok: true, json: async () => ({contact})} : {ok: false, status: 403}});
  assert.equal(progress.sequences[0].status, "paused");
  assert.equal(progress.sequences[0].name, sequenceId);
  assert.equal(progress.stageId, "stage");
  assert.equal(progress.warnings.length, 2);
  assert.ok(progress.warnings.some(message => message.includes("contact_stages/index")));
});

test("contact read failure and mismatched identity never produce empty success", async () => {
  await assert.rejects(getApolloProgress({contactId: id, fetchImpl: async () => ({ok: false, status: 403})}), /contacts\/show/);
  await assert.rejects(getApolloProgress({contactId: id, fetchImpl: async () => ({ok: true, json: async () => ({contact: {id: "other"}})})}), /linked contact/);
  await assert.rejects(getApolloProgress({contactId: "../wrong", fetchImpl: () => assert.fail()}), /Invalid/);
});

test("sequence metadata searches subsequent pages when necessary", async () => {
  const pages = [];
  const progress = await getApolloProgress({contactId: id, fetchImpl: async url => {
    let data;
    if (url.includes("contacts/")) data = {contact: {...contact, contact_stage_id: null}};
    else {
      const page = new URL(url).searchParams.get("page");
      pages.push(page);
      data = {emailer_campaigns: page === "1" ? Array.from({length: 100}, (_, i) => ({id: `other-${i}`})) : [campaign], pagination: {total_pages: 2}};
    }
    return {ok: true, json: async () => data};
  }});
  assert.deepEqual(pages, ["1", "2"]);
  assert.equal(progress.sequences[0].name, "Electronica");
});
