import test from "node:test";
import assert from "node:assert/strict";
import {normalizeSequenceRules, resolveApolloSequence, apolloLeadLabels} from "./apolloRouting.mjs";
import {sendLeadToApollo} from "./apolloOutreach.mjs";
import {apolloSettingsPatch, apolloSettingsStatus} from "./apolloSettingsCore.mjs";
const first = "507f1f77bcf86cd799439011";
const second = "507f1f77bcf86cd799439012";
const rules = [{category: "Recruiter", sequenceId: first, sequenceName: "Recruiter outreach"}, {category: "Interim Firm", sequenceId: second, sequenceName: "Interim outreach"}];

test("first matching rule wins regardless of tag order, with case and whitespace normalization", () => {
  const settings = {sequenceRules: rules, sequenceId: second};
  assert.equal(resolveApolloSequence(settings, ["Interim Firm", " recruiter "]).sequenceId, first);
  assert.equal(resolveApolloSequence({...settings, sequenceRules: [...rules].reverse()}, ["Recruiter", "Interim Firm"]).sequenceId, second);
  assert.equal(resolveApolloSequence(settings, ["Manufacturer"]).category, null);
  assert.equal(resolveApolloSequence({sequenceRules: rules}, ["Manufacturer"]), null);
  assert.equal(resolveApolloSequence(settings, []).sequenceId, second);
});

test("labels are deduplicated and rules validate without overwriting saved credentials", () => {
  assert.deepEqual(apolloLeadLabels(["Recruiter", "recruiter", " website_leads ", "Interim Firm"]), ["Recruiter", "Interim Firm"]);
  assert.deepEqual(normalizeSequenceRules(rules), rules);
  assert.throws(() => normalizeSequenceRules([...rules, {...rules[0], category: " recruiter "}]), /unique/);
  assert.throws(() => normalizeSequenceRules([{category: "Recruiter", sequenceId: "../wrong"}]), /Choose a sequence/);
  assert.throws(() => normalizeSequenceRules([{category: "", sequenceId: first}]), /unique/);
  assert.deepEqual(apolloSettingsPatch({enabled: true, sequenceRules: rules}).sequenceRules, rules);
  assert.equal(apolloSettingsPatch({enabled: true}).sequenceRules, undefined);
});

test("Apollo receives all categories as labels but only one routed contact enrollment", async () => {
  const calls = [];
  const responses = [{existing_contacts: [{id: first, email: "person@example.com"}]}, {contact: {id: first}}, {labels: [{name: "website_leads"}, {name: "Recruiter"}, {name: "Interim Firm"}]}, {contacts: [{id: first}]}];
  const result = await sendLeadToApollo({contact: {firstName: "Person", email: "person@example.com"}, categories: ["Recruiter", "Interim Firm"], enroll: true, apiKey: "test", settings: {available: true, listEnabled: true, sequenceEnabled: true, sequenceRules: rules, emailAccountId: second}, fetchImpl: async (url, options) => {calls.push({url, body: JSON.parse(options.body)}); return {ok: true, json: async () => responses.shift()};}});
  assert.equal(result.sequenceStatus, "enrolled");
  assert.deepEqual(calls[2].body.label_names, ["website_leads", "Recruiter", "Interim Firm"]);
  assert.equal(calls[3].body.emailer_campaign_id, first);
  assert.deepEqual(calls[3].body.contact_ids, [first]);
});

test("no matching rule blocks enrollment before writes, but list-only addition remains available", async () => {
  const args = {contact: {firstName: "Person", email: "person@example.com"}, categories: ["Manufacturer"], apiKey: "test", settings: {available: true, listEnabled: true, sequenceEnabled: true, sequenceRules: rules, emailAccountId: second}};
  await assert.rejects(sendLeadToApollo({...args, enroll: true, fetchImpl: async () => assert.fail("Must not write")}), {status: 403});
  let count = 0;
  const result = await sendLeadToApollo({...args, fetchImpl: async () => ({ok: true, json: async () => ++count === 1 ? {created_contacts: [{id: first, email: "person@example.com"}]} : {labels: [{name: "website_leads"}, {name: "Manufacturer"}]}})});
  assert.equal(result.listAdded, true);
  assert.equal(count, 2);
});

test("missing category confirmation preserves partial success without enrolling", async () => {
  let count = 0;
  const result = await sendLeadToApollo({contact: {firstName: "Person", email: "person@example.com"}, categories: ["Recruiter"], enroll: true, apiKey: "test", settings: {available: true, listEnabled: true, sequenceEnabled: true, sequenceRules: rules, emailAccountId: second}, fetchImpl: async () => ({ok: true, json: async () => ++count === 1 ? {created_contacts: [{id: first, email: "person@example.com"}]} : {labels: [{name: "website_leads"}]}})});
  assert.equal(result.listAdded, true);
  assert.equal(result.sequenceStatus, "not_requested");
  assert.equal(count, 2);
  assert.match(result.message, /not confirmed/);
});

test("every category gets an independent selector and multiple assignments survive settings serialization", async () => {
  const {categorySequenceRows} = await import("./apolloRouting.mjs");
  const {apolloSettingsStatus} = await import("./apolloSettingsCore.mjs");
  const rows = categorySequenceRows(["Recruiter", "Interim Firm", "Manufacturer", " recruiter "], rules);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].sequenceId, first);
  assert.equal(rows[1].sequenceId, second);
  assert.equal(rows[2].sequenceId, "");
  const saved = apolloSettingsStatus(apolloSettingsPatch({enabled: true, sequenceRules: rules}));
  assert.equal(resolveApolloSequence(saved, ["Recruiter"]).sequenceId, first);
  assert.equal(resolveApolloSequence(saved, ["Interim Firm"]).sequenceId, second);
  assert.equal(resolveApolloSequence(saved, ["Manufacturer"]), null);
  assert.deepEqual(categorySequenceRows([], saved.sequenceRules).map((row) => row.category), ["Recruiter", "Interim Firm"]);
});

test("restores confirmed sequence after reload without guessing among multiple memberships", async () => {
  const {savedApolloSequence} = await import("./apolloRouting.mjs");
  const sequences = [{id: first, name: "Electronica"}, {id: second, name: "SPS"}];
  const apollo = {progress: {membershipsKnown: true, sequences}, lastEnrollment: {sequenceId: second, status: "enrolled"}};
  assert.deepEqual(savedApolloSequence(JSON.parse(JSON.stringify(apollo))), {id: second, label: "SPS"});
  assert.equal(savedApolloSequence({progress: {sequences}}), null);
  assert.deepEqual(savedApolloSequence({progress: {sequences: [sequences[0]]}}), {id: first, label: "Electronica"});
  assert.equal(savedApolloSequence({...apollo, progress: {membershipsKnown: true, sequences: []}}), null);
  assert.equal(savedApolloSequence({lastEnrollment: {sequenceId: first, status: "unknown"}}), null);
  assert.deepEqual(savedApolloSequence({lastEnrollment: {sequenceId: first, status: "enrolled"}}), {id: first, label: first});
});

test('source routing wins over contact type, but explicit selection wins over source', () => {
  const settings = {sequenceId: 'c'.repeat(24), sequenceRules: [{category: 'Manufacturer', sequenceId: 'a'.repeat(24)}], sourceSequenceRules: [{category: 'Trade fair', sequenceId: 'b'.repeat(24)}]};
  assert.equal(resolveApolloSequence(settings, ['Manufacturer'], '', '  TRADE fair ').sequenceId, 'b'.repeat(24));
  assert.equal(resolveApolloSequence(settings, ['Manufacturer'], 'd'.repeat(24), 'Trade fair').sequenceId, 'd'.repeat(24));
  assert.equal(resolveApolloSequence(settings, ['Manufacturer'], '', 'LinkedIn').sequenceId, 'a'.repeat(24));
  assert.equal(resolveApolloSequence(settings, [], '', 'LinkedIn').sequenceId, 'c'.repeat(24));
});

test('source rules persist, support full source length, reject duplicates and preserve legacy settings', () => {
  const rules = [{category: 'S'.repeat(200), sequenceId: 'a'.repeat(24), sequenceName: 'Event outreach'}];
  const patch = apolloSettingsPatch({enabled: true, sourceSequenceRules: rules});
  assert.deepEqual(apolloSettingsStatus(patch).sourceSequenceRules, rules);
  assert.deepEqual(apolloSettingsStatus({}).sourceSequenceRules, []);
  assert.equal(apolloSettingsPatch({enabled: true}).sourceSequenceRules, undefined);
  assert.throws(() => apolloSettingsPatch({enabled: true, sourceSequenceRules: [...rules, {...rules[0], category: rules[0].category.toLowerCase()}]}), /unique/);
  assert.throws(() => apolloSettingsPatch({enabled: true, sourceSequenceRules: [{category: 'LinkedIn', sequenceId: 'bad'}]}), /Choose a sequence/);
});
