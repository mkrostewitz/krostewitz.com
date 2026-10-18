import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {MongoClient} from "mongodb";
import {ensureTimeline, CV_TIMELINE_COLLECTION, TIMELINE_LANGUAGES} from "../src/app/lib/cvTimelineData.mjs";

const require = createRequire(import.meta.url);
require("@next/env").loadEnvConfig(process.cwd());
const defaults = Object.fromEntries(await Promise.all(TIMELINE_LANGUAGES.map(async (language) => [language,
  JSON.parse(await readFile(new URL(`../src/locales/${language}/translation.json`, import.meta.url), "utf8")),
])));
const {MONGO_DB_URI, MONGO_DB_NAME, MONGO_DB_USER, MONGO_DB_PASSWORD} = process.env;
if (!MONGO_DB_URI || !MONGO_DB_NAME || !MONGO_DB_USER || !MONGO_DB_PASSWORD) throw new Error("MongoDB environment variables are required.");
const client = new MongoClient(MONGO_DB_URI, {auth: {username: MONGO_DB_USER, password: MONGO_DB_PASSWORD}});
try {
  await client.connect();
  const document = await ensureTimeline(client.db(MONGO_DB_NAME), defaults);
  console.log(`Collection: ${CV_TIMELINE_COLLECTION}; individual entry documents: ${document.entries.length}. Existing timeline edits are preserved.`);
} finally {
  await client.close();
}
