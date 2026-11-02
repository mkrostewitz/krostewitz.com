import test from "node:test";
import assert from "node:assert/strict";
import {ensureApolloSourceField, sourceFieldId} from "./apolloSource.mjs";
import {normalizeLeadSource, saveLeadSource} from "./leadSource.mjs";
import {normalizeContact} from "./leadOutreach.mjs";
const id = "507f1f77bcf86cd799439011";
const field = {id: `contact.${id}`, label: "Website Source", modality: "contact", type: "string", editable: false, meta: {computed_type: "manual"}};

test("Source is a single normalized value; old clients do not erase it", () => {
  assert.equal(normalizeLeadSource(" LinkedIn  referral "), "LinkedIn referral");
  for (const value of [["LinkedIn", "Event"], {}, null, "x\ny", "x".repeat(201)]) assert.throws(() => normalizeLeadSource(value));
  assert.equal(Object.hasOwn(normalizeContact({firstName: "Test"}), "source"), false);
  assert.equal(normalizeContact({firstName: "Test", source: ""}).source, "");
});

test("saved choices survive clearing and reuse canonical spelling", async () => {
  const rows = new Map();
  const db = {collection: () => ({
    updateOne: async ({_id}, update) => {if (!rows.has(_id)) rows.set(_id, update.$setOnInsert);},
    findOne: async ({_id}) => rows.get(_id),
  })};
  assert.equal(await saveLeadSource(db, "LinkedIn"), "LinkedIn");
  assert.equal(await saveLeadSource(db, " linkedin "), "LinkedIn");
  assert.equal(await saveLeadSource(db, ""), "");
  assert.equal(rows.size, 1);
});

test("reuse the custom contact field and exclude system/account/computed fields", async () => {
  assert.equal(sourceFieldId(field), id);
  assert.equal(sourceFieldId({...field, id: "contact.source", label: "Source"}), null);
  assert.equal(sourceFieldId({...field, modality: "account"}), null);
  assert.equal(sourceFieldId({...field, meta: {computed_type: "prompt_execution"}}), null);
  assert.equal(await ensureApolloSourceField({apiKey: "test", fetchImpl: async (url, options) => {
    assert.equal(options.method, "GET");
    return {ok: true, json: async () => ({fields: [field]})};
  }}), id);
});

test("creates a missing field using Apollo's schema and refuses conflicting field types", async () => {
  const methods = [];
  assert.equal(await ensureApolloSourceField({apiKey: "test", fetchImpl: async (url, options) => {
    methods.push(options.method);
    if (options.method === "GET") return {ok: true, json: async () => ({fields: []})};
    assert.deepEqual(JSON.parse(options.body), {label: "Website Source", modality: "contact", type: "string", meta: {max_length: 200}});
    return {ok: true, json: async () => ({field})};
  }}), id);
  assert.deepEqual(methods, ["GET", "POST"]);
  await assert.rejects(ensureApolloSourceField({apiKey: "test", fetchImpl: async () => ({ok: true, json: async () => ({fields: [{...field, type: "number"}]})})}), /single-line text/);
});

test("Contact Type field provisioning is separate from Website Source", async () => {
  const calls = [];
  const tags = {...field, label: "Contact Type"};
  assert.equal(await ensureApolloSourceField({apiKey: "test", label: "Contact Type", maxLength: 6000,
    fetchImpl: async (url, options) => {
      calls.push(options);
      return {ok: true, json: async () => options.method === "GET" ? {fields: [field]} : {field: tags}};
    }}), id);
  assert.deepEqual(JSON.parse(calls[1].body), {label: "Contact Type", modality: "contact", type: "string", meta: {max_length: 6000}});
});
