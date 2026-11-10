import {createRequire} from 'node:module';
import {readFile, mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MongoClient, BSON} from 'mongodb';

// Labels follow the sectors/applications in the saved CV classification review.
// Preserve catalog IDs, descriptions, icons and role assignments. Ambiguous
// "Elec" is intentionally excluded at the owner's request.
createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const labels = JSON.parse(await readFile(new URL('./data/industry-labels-2026.json', import.meta.url), 'utf8'));
const apply = process.argv.includes('--apply');
const client = new MongoClient(process.env.MONGO_DB_URI, {
  auth: {username: process.env.MONGO_DB_USER, password: process.env.MONGO_DB_PASSWORD},
  serverSelectionTimeoutMS: 5000,
});
try {
  await client.connect();
  const collection = client.db(process.env.MONGO_DB_NAME).collection('experience_industries');
  const rows = await collection.find({_id: {$in: Object.keys(labels)}}).toArray();
  const changes = rows.filter(row => {
    const [en, de] = labels[row._id];
    return row.label !== en || row.translations?.en?.label !== en || row.translations?.de?.label !== de;
  });
  console.log(JSON.stringify({mode: apply ? 'apply' : 'preview', changes: changes.map(row => ({id: row._id, before: row.label, en: labels[row._id][0], de: labels[row._id][1]}))}, null, 2));
  if (apply && changes.length) {
    const backup = join(await mkdtemp(join(tmpdir(), 'industry-labels-')), 'before.json');
    await writeFile(backup, BSON.EJSON.stringify(changes, null, 2), {mode: 0o600, flag: 'wx'});
    console.log(`Backup: ${backup}`);
    for (const row of changes) {
      const [en, de] = labels[row._id];
      const result = await collection.updateOne({_id: row._id, revision: row.revision}, {
        $set: {label: en, 'translations.en.label': en, 'translations.de.label': de, updatedAt: new Date()},
        $inc: {revision: 1},
      });
      if (!result.matchedCount) throw new Error(`Industry changed during update: ${row._id}`);
    }
    console.log(`Updated ${changes.length} industries.`);
  }
} finally {await client.close();}
