import {readFile, writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {MongoClient} from 'mongodb';
import {ensureFold, publicFold, saveFold, FOLD_COLLECTION} from '../src/app/lib/foldStorage.mjs';
import {FOLD_ID, exportFoldContent, importFoldContent} from '../src/app/lib/foldContent.mjs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('node scripts/migrate-fold.mjs [--export FILE | --import FILE] [--dry-run]\nUse node --env-file=.env.online scripts/migrate-fold.mjs ... to select production explicitly.');
  process.exit(0);
}
const flags = new Set(['--export', '--import', '--dry-run']);
for (let i = 0; i < args.length; i++) {
  if (!flags.has(args[i])) throw new Error(`Unknown option: ${args[i]}`);
  if (args[i] !== '--dry-run' && (!args[++i] || args[i].startsWith('--'))) throw new Error('Provide a file path.');
}
if (args.includes('--export') && args.includes('--import')) throw new Error('Choose export or import.');
const pathFor = flag => args.includes(flag) ? args[args.indexOf(flag) + 1] : null;
const importPath = pathFor('--import');
const exportPath = pathFor('--export');
const imported = importPath ? importFoldContent(JSON.parse(await readFile(importPath, 'utf8'))) : null;
const require = createRequire(import.meta.url);
require('@next/env').loadEnvConfig(process.cwd());
const defaults = Object.fromEntries(await Promise.all(['en', 'de'].map(async language => [language,
  JSON.parse(await readFile(new URL(`../src/locales/${language}/translation.json`, import.meta.url), 'utf8')),
])));
const {MONGO_DB_URI, MONGO_DB_NAME, MONGO_DB_USER, MONGO_DB_PASSWORD} = process.env;
if (!MONGO_DB_URI || !MONGO_DB_NAME || !MONGO_DB_USER || !MONGO_DB_PASSWORD) throw new Error('MongoDB environment variables are required.');
const client = new MongoClient(MONGO_DB_URI, {auth: {username: MONGO_DB_USER, password: MONGO_DB_PASSWORD}, serverSelectionTimeoutMS: 15000});
try {
  await client.connect();
  const db = client.db(MONGO_DB_NAME);
  const existing = await db.collection(FOLD_COLLECTION).findOne({_id: FOLD_ID});
  if (args.includes('--dry-run')) {
    console.log(`${FOLD_COLLECTION}/${FOLD_ID}: ${existing ? 'record exists' : 'record will be initialized with bilingual copy and a legacy backup'}. ${imported ? 'Import validated; destination bindings will be preserved.' : 'Existing edits will be preserved.'} No database writes performed.`);
  } else if (exportPath) {
    if (!existing) throw new Error('Run the migration first to create the Fold record.');
    await writeFile(exportPath, JSON.stringify(exportFoldContent(existing), null, 2) + '\n', {flag: 'wx'});
    console.log(`Exported bilingual editorial content to ${exportPath}. Destination URLs and backups are excluded.`);
  } else {
    const content = imported ? await saveFold(db, imported, null, defaults) : publicFold(await ensureFold(db, defaults));
    console.log(`${FOLD_COLLECTION}/${FOLD_ID}: ${imported ? 'imported; previous content preserved' : 'initialized or existing edits preserved'}. Languages: ${Object.keys(content.translations).join(', ')}. CTA destinations preserved.`);
  }
} finally {await client.close();}
