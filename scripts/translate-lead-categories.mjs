import {createRequire} from 'node:module';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MongoClient, BSON} from 'mongodb';
import {translateCategoryLabels} from '../src/app/lib/leadCategoryAi.mjs';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const apply = process.argv.includes('--apply');
const client = new MongoClient(process.env.MONGO_DB_URI, {
  auth: {username: process.env.MONGO_DB_USER, password: process.env.MONGO_DB_PASSWORD}, serverSelectionTimeoutMS: 5000,
});
try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME);
  const rows = [];
  for (const kind of ['products', 'applications', 'industries']) {
    for (const row of await db.collection(`lead_${kind}`).find({}).toArray()) {
      if (!row.translations?.en || !row.translations?.de) rows.push({kind, row});
    }
  }
  console.log(JSON.stringify({mode: apply ? 'apply' : 'preview', missingTranslations: rows.length,
    counts: Object.fromEntries(['products', 'applications', 'industries'].map(kind => [kind, rows.filter(item => item.kind === kind).length]))}));
  if (apply && rows.length) {
    const backup = join(await mkdtemp(join(tmpdir(), 'lead-category-translations-')), 'before.json');
    await writeFile(backup, BSON.EJSON.stringify(rows, null, 2), {mode: 0o600, flag: 'wx'});
    console.log(`Backup: ${backup}`);
    const settings = await db.collection('site_content').findOne({_id: 'ai_settings'});
    const labels = [...new Set(rows.map(({row}) => row.label))];
    const translated = new Map();
    for (let start = 0; start < labels.length; start += 25) {
      const batch = labels.slice(start, start + 25);
      const values = await translateCategoryLabels({labels: batch, model: settings?.model || 'gpt-5.5', apiKey: process.env.OPENAI_API_KEY});
      batch.forEach((label, index) => translated.set(label, values[index]));
      console.log(`Translated ${Math.min(start + 25, labels.length)}/${labels.length} unique labels.`);
    }
    let updated = 0;
    for (const {kind, row} of rows) {
      const fields = {};
      for (const language of ['en', 'de']) if (!row.translations?.[language]) fields[`translations.${language}`] = translated.get(row.label)[language];
      const filter = {_id: row._id, label: row.label};
      for (const field of Object.keys(fields)) {
        const original = row.translations?.[field.split('.')[1]];
        filter[field] = original === undefined ? {$exists: false} : original;
      }
      const result = await db.collection(`lead_${kind}`).updateOne(filter, {$set: {...fields, updatedAt: new Date()}});
      updated += result.modifiedCount;
    }
    console.log(`Updated ${updated}/${rows.length} entries; preserved canonical labels and existing translations.`);
  }
} finally {await client.close();}
