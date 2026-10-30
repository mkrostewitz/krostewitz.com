import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLeadType, saveLeadType} from "./leadTypes.mjs";

function catalog() {
  const records = new Map();
  return {
    records,
    async updateOne({_id}, {$setOnInsert}) {
      if (!records.has(_id)) records.set(_id, {_id, ...$setOnInsert});
    },
    async findOne({_id}) { return records.get(_id); },
  };
}

test("lead types normalize whitespace and reject invalid or oversized input", () => {
  assert.equal(normalizeLeadType("  Head\n Hunter\u0000 "), "Head Hunter");
  assert.equal(normalizeLeadType(null), "");
  assert.equal(normalizeLeadType("   "), "");
  for (const value of [{}, [], 12, "x".repeat(101)]) {
    assert.throws(() => normalizeLeadType(value), {name: "OutreachValidationError"});
  }
});

test("saved types reuse the original label and remain available when a type is cleared", async () => {
  const collection = catalog();
  assert.equal(await saveLeadType(collection, "Head Hunter"), "Head Hunter");
  assert.equal(await saveLeadType(collection, " head   hunter "), "Head Hunter");
  assert.equal(await saveLeadType(collection, "Ｈｅａｄ Hunter"), "Head Hunter");
  assert.equal(collection.records.size, 1);
  assert.equal(await saveLeadType(collection, ""), "");
  assert.equal(collection.records.size, 1);
  assert.equal(await saveLeadType(collection, "Manufacturer"), "Manufacturer");
  assert.equal(collection.records.size, 2);
});

test("concurrent creation reuses the winning label while other database errors propagate", async () => {
  const collection = {
    async updateOne() { throw Object.assign(new Error("Duplicate"), {code: 11000}); },
    async findOne() { return {label: "Manufacturer"}; },
  };
  assert.equal(await saveLeadType(collection, "manufacturer"), "Manufacturer");
  collection.updateOne = async () => { throw new Error("Unavailable"); };
  await assert.rejects(saveLeadType(collection, "New type"), /Unavailable/);
});

test("multiple tags retain legacy assignments and allow clearing them", async () => {
  const {getLeadTypes, normalizeLeadTypes, saveLeadTypes} = await import("./leadTypes.mjs");
  assert.deepEqual(getLeadTypes({leadType: "Head Hunter"}), ["Head Hunter"]);
  assert.deepEqual(getLeadTypes({leadType: "Head Hunter", leadTypes: []}), []);
  assert.deepEqual(normalizeLeadTypes([" Manufacturer ", "manufacturer", "Head Hunter", ""]), ["Manufacturer", "Head Hunter"]);
  assert.throws(() => normalizeLeadTypes("Manufacturer"));
  assert.throws(() => normalizeLeadTypes(Array(51).fill("tag")));
  const collection = catalog();
  await saveLeadType(collection, "Manufacturer");
  assert.deepEqual(await saveLeadTypes(collection, ["manufacturer", "Head Hunter"]), ["Manufacturer", "Head Hunter"]);
  assert.deepEqual(await saveLeadTypes(collection, []), []);
  assert.equal(collection.records.size, 2);
});

test("tag filters match any selected tag and combine with existing filters", async () => {
  const {matchesLeadFilters} = await import("./leadOutreach.mjs");
  const lead = {name: "Jane", status: "pending", source: {type: "manual"}, leadTypes: ["Manufacturer", "Partner"]};
  assert.equal(matchesLeadFilters(lead, {tags: ["Head Hunter", "manufacturer"]}), true);
  assert.equal(matchesLeadFilters(lead, {tags: ["Head Hunter"]}), false);
  assert.equal(matchesLeadFilters(lead, {tags: ["Partner"], status: "won"}), false);
  assert.equal(matchesLeadFilters(lead, {tags: ["Partner"], source: "manual", search: "jane"}), true);
  assert.equal(matchesLeadFilters(lead, {search: "manufacturer"}), true);
  assert.equal(matchesLeadFilters({leadType: "Head Hunter"}, {tags: [" head  hunter "]}), true);
  assert.equal(matchesLeadFilters({}, {tags: ["Manufacturer"]}), false);
  assert.equal(matchesLeadFilters({}, {tags: []}), true);
});
