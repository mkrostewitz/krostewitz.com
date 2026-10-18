import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {normalizeTimeline, seedTimelineEntries, localizeTimeline, ensureTimeline, timelineOperations} from "./cvTimelineData.mjs";

const defaults = Object.fromEntries(await Promise.all(["en", "de"].map(async (language) => [language, JSON.parse(await readFile(new URL(`../../locales/${language}/translation.json`, import.meta.url), "utf8"))])));

test("migration preserves every current timeline field and order in both languages", () => {
  const entries = seedTimelineEntries(defaults);
  for (const language of ["en", "de"]) {
    assert.deepEqual(localizeTimeline(entries, language).map(({id, ...item}) => item), defaults[language].timeline);
  }
});

test("supports empty timelines and rejects malformed entries and duplicate IDs", () => {
  assert.deepEqual(normalizeTimeline([]), []);
  for (const value of [null, {}, [null], [{id: "entry"}], Array(101).fill({})]) {
    assert.throws(() => normalizeTimeline(value));
  }
  const entry = seedTimelineEntries(defaults)[0];
  assert.throws(() => normalizeTimeline([entry, entry]));
  assert.throws(() => normalizeTimeline([{...entry, translations: {en: {...entry.translations.en, highlights: "wrong"}}}]));
});

test("localization falls back as a whole and preserves intentionally empty highlights", () => {
  const entry = normalizeTimeline([{id: "new", translations: {en: {title: "Role", period: "2026", highlights: []}}}])[0];
  assert.equal(localizeTimeline([entry], "de")[0].title, "Role");
  assert.deepEqual(localizeTimeline([entry], "de")[0].highlights, []);
});

function memoryDb(initial = {}) {
  const collections = structuredClone(initial);
  return {collections, collection(name) {
    const docs = collections[name] ||= [];
    const matches = (doc, filter) => typeof filter._id === "object" ? doc._id !== filter._id.$ne : doc._id === filter._id;
    return {
      findOne: async (filter) => docs.find((doc) => matches(doc, filter)) || null,
      find: (filter) => {
        const result = docs.filter((doc) => matches(doc, filter));
        const cursor = {sort: () => {result.sort((a, b) => a.order - b.order); return cursor;}, toArray: async () => result};
        return cursor;
      },
      updateOne: async (filter, update) => {
        if (!docs.some((doc) => matches(doc, filter))) docs.push({...filter, ...update.$setOnInsert});
      },
      bulkWrite: async (operations) => {
        for (const {updateOne: operation} of operations) {
          assert.deepEqual(Object.keys(operation.update), ["$setOnInsert"]);
          if (!docs.some((doc) => matches(doc, operation.filter))) docs.push({...operation.filter, ...operation.update.$setOnInsert});
        }
      },
      deleteOne: async (filter) => {
        const index = docs.findIndex((doc) => matches(doc, filter));
        if (index >= 0) docs.splice(index, 1);
      },
    };
  }};
}

test("migrates the aggregate into individual ordered documents and preserves edits and audit fields", async () => {
  const entries = seedTimelineEntries(defaults);
  entries[0].translations.en.title = "Edited role";
  const db = memoryDb({cv_timeline: [{_id: "timeline", entries, revision: 4, updatedBy: "admin", createdAt: "created"}]});
  const result = await ensureTimeline(db, defaults);
  assert.deepEqual(result, {entries, revision: 4});
  assert.equal(db.collections.cv_timeline.length, entries.length);
  assert.equal(db.collections.cv_timeline[0]._id, entries[0].id);
  assert.equal(db.collections.cv_timeline[0].order, 0);
  assert.equal(db.collections.cv_timeline[0].updatedBy, "admin");
  assert.equal(db.collections.cv_timeline[0].createdAt, "created");
  assert.equal(db.collections.cv_timeline.some((doc) => "entries" in doc), false);
  assert.deepEqual(await ensureTimeline(db, defaults), result);
});

test("empty aggregate migration remains empty on subsequent access", async () => {
  const db = memoryDb({cv_timeline: [{_id: "timeline", entries: [], revision: 3}]});
  assert.deepEqual(await ensureTimeline(db, defaults), {entries: [], revision: 3});
  assert.deepEqual(await ensureTimeline(db, defaults), {entries: [], revision: 3});
  assert.equal(db.collections.cv_timeline.length, 0);
});

test("initialization preserves imported entries without reseeding defaults", async () => {
  const entry = seedTimelineEntries(defaults)[2];
  const db = memoryDb({cv_timeline: [{_id: entry.id, order: 2, translations: entry.translations}]});
  assert.deepEqual((await ensureTimeline(db, defaults)).entries, [entry]);
});

test("initialization uses stored translations and retry preserves individual edits", async () => {
  const legacy = structuredClone(defaults);
  legacy.en.timeline[0].title = "Stored title";
  const db = memoryDb({site_content: [{_id: "translations", translations: legacy}]});
  const result = await ensureTimeline(db, defaults);
  assert.equal(result.entries[0].translations.en.title, "Stored title");
  const entries = seedTimelineEntries(defaults);
  const retry = memoryDb({cv_timeline: [
    {_id: "timeline", entries, revision: 0},
    {_id: entries[0].id, order: 0, translations: result.entries[0].translations},
  ]});
  assert.equal((await ensureTimeline(retry, defaults)).entries[0].translations.en.title, "Stored title");
});

test("save operations keep stable document IDs and update display order", () => {
  const entries = seedTimelineEntries(defaults).reverse();
  const operations = timelineOperations(entries, {updatedBy: "admin"});
  assert.equal(operations[0].updateOne.filter._id, entries[0].id);
  assert.equal(operations[0].updateOne.update.$set.order, 0);
  assert.deepEqual(operations[0].updateOne.update.$set.translations, entries[0].translations);
  assert.equal(operations[0].updateOne.update.$set.updatedBy, "admin");
});
