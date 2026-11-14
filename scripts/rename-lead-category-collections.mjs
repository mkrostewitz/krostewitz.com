import {createRequire} from 'node:module';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MongoClient, BSON} from 'mongodb';

// Run against each environment before deploying the code using lead_* catalogs.
// Preview by default; never replace an existing destination collection.
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const apply = process.argv.includes('--apply');
const client = new MongoClient(process.env.MONGO_DB_URI, {
  auth: {username: process.env.MONGO_DB_USER, password: process.env.MONGO_DB_PASSWORD}, serverSelectionTimeoutMS: 5000,
});
try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME);
  const names = new Set((await db.listCollections({}, {nameOnly: true}).toArray()).map(row => row.name));
  const moves = ['products', 'applications', 'industries'].map(kind => ({from: `contact_${kind}`, to: `lead_${kind}`}));
  for (const {from, to} of moves) {
    if (names.has(from) && names.has(to)) throw new Error(`Both ${from} and ${to} exist. Resolve the conflict before renaming; no collections were changed.`);
  }
  console.log(JSON.stringify({mode: apply ? 'apply' : 'preview', collections: moves.map(move => ({...move,
    action: names.has(move.from) ? 'rename' : names.has(move.to) ? 'already renamed' : 'not present'}))}, null, 2));
  const pending = moves.filter(move => names.has(move.from));
  if (apply && pending.length) {
    const backup = join(await mkdtemp(join(tmpdir(), 'lead-category-rename-')), 'before.json');
    const snapshot = {};
    for (const {from} of pending) snapshot[from] = {
      documents: await db.collection(from).find({}).toArray(),
      indexes: await db.collection(from).listIndexes().toArray(),
    };
    await writeFile(backup, BSON.EJSON.stringify(snapshot, null, 2), {mode: 0o600, flag: 'wx'});
    console.log(`Backup: ${backup}`);
    for (const {from, to} of pending) {
      await db.collection(from).rename(to, {dropTarget: false});
      console.log(`Renamed ${from} → ${to} (${await db.collection(to).countDocuments()} documents).`);
    }
  }
} finally {await client.close();}
