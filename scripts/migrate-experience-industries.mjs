import {createRequire} from 'node:module';
import {mkdtemp, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {MongoClient, BSON} from 'mongodb';
import {ensureIndustries, getIndustries} from '../src/app/lib/industryStorage.mjs';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const client = new MongoClient(process.env.MONGO_DB_URI, {auth: {username: process.env.MONGO_DB_USER, password: process.env.MONGO_DB_PASSWORD}, serverSelectionTimeoutMS: 5000});
try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME);
  const sources = {
    translations: await db.collection('site_content').findOne({_id: 'translations'}),
    contactIndustries: await db.collection('contact_industries').find({}).toArray(),
    industries: await db.collection('experience_industries').find({}).toArray(),
    migration: await db.collection('site_content').findOne({_id: 'experience_industries_v1'}),
  };
  console.log(JSON.stringify({mode: process.argv.includes('--apply') ? 'apply' : 'preview', legacyIndustries: sources.contactIndustries.length, existingIndustries: sources.industries.length, migrated: Boolean(sources.migration)}));
  if (process.argv.includes('--apply')) {
    const backup = join(await mkdtemp(join(tmpdir(), 'experience-industries-')), 'before.json');
    await writeFile(backup, BSON.EJSON.stringify(sources, null, 2), {mode: 0o600, flag: 'wx'});
    console.log(`Backup: ${backup}`);
    await ensureIndustries(db);
    const industries = await getIndustries(db);
    console.log(JSON.stringify({industries: industries.length, withDescriptions: industries.filter(item => Object.values(item.translations).some(value => value.detail)).length}));
  }
} finally {await client.close();}
