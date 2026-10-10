import assert from "node:assert/strict";
import {test} from "node:test";
import {registerPostCategories} from "./postCategories.mjs";

function createDatabase({writeError, race = false} = {}) {
  const documents = new Map();
  const collection = {
    async updateOne({_id}, {$setOnInsert}) {
      if (writeError) throw writeError;
      if (!documents.has(_id)) documents.set(_id, {...$setOnInsert});
      // Simulate a competing insert winning the unique-key race.
      if (race) throw Object.assign(new Error("Duplicate key"), {code: 11000});
    },
    async findOne({_id}) {
      return documents.get(_id) || null;
    },
  };
  return {collection: () => collection, documents};
}

test("saved categories are reused with their original label across posts", async () => {
  const db = createDatabase();
  const category = {label: "Market Data", slug: "market-data"};
  assert.deepEqual(await registerPostCategories(db, [category]), [category]);
  assert.deepEqual(await registerPostCategories(db, [
    {label: "market data", slug: "market-data"},
  ]), [category]);
  assert.equal(db.documents.size, 1);

  // Removing a category from a post must not remove it from the library.
  assert.deepEqual(await registerPostCategories(db, []), []);
  assert.equal(db.documents.get("market-data").label, "Market Data");
});

test("concurrent saves return the same canonical category", async () => {
  const db = createDatabase();
  const results = await Promise.all([
    registerPostCategories(db, [{label: "Sailing", slug: "sailing"}]),
    registerPostCategories(db, [{label: "SAILING", slug: "sailing"}]),
  ]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(db.documents.size, 1);
});

test("a duplicate-key race reuses the winning document", async () => {
  const db = createDatabase({race: true});
  const category = {label: "Cooking", slug: "cooking"};
  assert.deepEqual(await registerPostCategories(db, [category]), [category]);
});

test("database failures propagate instead of reporting a successful save", async () => {
  const writeError = new Error("Database unavailable");
  await assert.rejects(
    registerPostCategories(createDatabase({writeError}), [
      {label: "Cooking", slug: "cooking"},
    ]),
    writeError
  );
});
