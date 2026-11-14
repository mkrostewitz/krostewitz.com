import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {MongoClient, BSON} from 'mongodb';
import {resolveExperienceIndustry, classificationKey, normalizeClassifications} from '../src/app/lib/experienceClassifications.mjs';

createRequire(import.meta.url)('@next/env').loadEnvConfig(process.cwd());
const mapping = JSON.parse(await readFile(new URL('./data/cv-classifications-2026.json', import.meta.url), 'utf8'));
const apply = process.argv.includes('--apply');
const uri = process.env.MONGO_DB_URI;
// This task updates the local authoring database only. Production is imported separately.
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(uri).hostname)) throw new Error('This import is restricted to the local MongoDB host.');
const client = new MongoClient(uri, {auth: {username: process.env.MONGO_DB_USER, password: process.env.MONGO_DB_PASSWORD}});
try {
  await client.connect();
  const db = client.db(process.env.MONGO_DB_NAME);
  const timeline = db.collection('cv_timeline');
  const meta = await db.collection('site_content').findOne({_id: 'cv_timeline_settings'});
  if (!meta || !Number.isSafeInteger(meta.revision)) throw new Error('Initialize the CV editor before importing classifications.');
  const catalog = await db.collection('lead_industries').find({}).toArray();
  const entries = await timeline.find({}).toArray();
  const skillsCollection = db.collection('skills');
  const skills = await skillsCollection.find({}).toArray();
  const skillByLabel = new Map(skills.filter(row => row.type !== 'meta').map(row => [classificationKey(row.translations?.en?.label || row.label), row]));
  const missingSkills = (mapping.newSkills || []).filter(skill => !skillByLabel.has(classificationKey(skill.label)));
  if (skillByLabel.size + missingSkills.length > 12) throw new Error('Shared skill catalog would exceed 12 entries.');
  for (const skill of missingSkills) {
    skillByLabel.set(classificationKey(skill.label), {_id: `skill-${createHash('sha256').update(classificationKey(skill.label)).digest('hex')}`, ...skill});
  }
  const plan = mapping.roles.map(role => {
    const entry = entries.find(row => row._id === role.id);
    const identity = `${entry?.translations?.en?.title || ''} ${entry?.translations?.en?.company || ''}`;
    if (!entry || !identity.toLowerCase().includes(role.identity.toLowerCase())) throw new Error(`Review role mapping: ${role.id} does not match ${role.identity}.`);
    for (const label of role.competencies || []) {
      if (!skillByLabel.has(classificationKey(label))) throw new Error(`Missing skill: ${label}`);
    }
    return {role, entry};
  });
  console.log(JSON.stringify({mode: apply ? 'apply' : 'preview', roles: plan.map(({role, entry}) => ({id: role.id, role: role.identity, industries: role.industries.map(label => ({label, existingId: catalog.find(row => classificationKey(row.label) === classificationKey(label))?._id || null})), competencies: role.competencies, countries: role.countries, existing: entry.classifications || {}, evidence: role.evidence})), review: mapping.review}, null, 2));
  if (apply) {
    const backupDir = join(tmpdir(), 'krostewitz-cv-import');
    await mkdir(backupDir, {recursive: true});
    const backup = join(backupDir, `before-${Date.now()}.json`);
    await writeFile(backup, BSON.EJSON.stringify({entries, industries: catalog, skills, timelineSettings: meta}, null, 2), {mode: 0o600, flag: 'wx'});
    console.log(`Backup: ${backup}`);
    for (const [index, skill] of missingSkills.entries()) {
      const {_id} = skillByLabel.get(classificationKey(skill.label));
      await skillsCollection.updateOne({_id}, {$setOnInsert: {type: 'skill', order: skillByLabel.size - missingSkills.length + index, score: 5, translations: skill.translations, createdAt: new Date(), updatedAt: new Date(), updatedBy: 'cv-classification-import'}}, {upsert: true});
    }
    const updates = [];
    for (const {role, entry} of plan) {
      const industries = await Promise.all(role.industries.map(label => resolveExperienceIndustry(db, label)));
      const previous = entry.classifications || {};
      const classifications = normalizeClassifications({...previous,
        industries: [...new Set([...(previous.industries || []), ...industries.map(item => item.id)])],
        competencies: [...new Set([...(previous.competencies || []), ...(role.competencies || []).map(label => String(skillByLabel.get(classificationKey(label))._id))])],
        countries: [...new Set([...(previous.countries || []), ...role.countries])],
      });
      if (JSON.stringify(classifications) !== JSON.stringify(normalizeClassifications(previous))) updates.push({entry, classifications});
    }
    if (updates.length) {
      // Invalidate open editors before updating records on standalone MongoDB.
      const claimed = await db.collection('site_content').updateOne({_id: meta._id, revision: meta.revision}, {$inc: {revision: 1}, $set: {updatedAt: new Date()}});
      if (!claimed.matchedCount) throw new Error('Timeline changed during import; rerun after reviewing the latest records.');
      for (const {entry, classifications} of updates) {
        const result = await timeline.updateOne({_id: entry._id, updatedAt: entry.updatedAt ?? {$exists: false}, classifications: entry.classifications ?? {$exists: false}}, {$set: {classifications, updatedAt: new Date()}});
        if (!result.matchedCount) throw new Error(`Concurrent edit detected for ${entry._id}; review and rerun. Backup: ${backup}`);
      }
    }
    const after = await timeline.find({}).toArray();
    assert.equal(after.length, entries.length);
    const unchangedFields = ({classifications, updatedAt, ...rest}) => rest;
    for (const before of entries) {
      const saved = after.find(row => row._id === before._id);
      assert.deepEqual(unchangedFields(saved), unchangedFields(before), `Position content changed: ${before._id}`);
      const expected = updates.find(item => item.entry._id === before._id)?.classifications || normalizeClassifications(before.classifications || {});
      assert.deepEqual(normalizeClassifications(saved.classifications || {}), expected);
    }
    console.log('Verified all assignments and preservation of every position content field.');
    console.log(`Created ${missingSkills.length} shared skills.`);
    console.log(`Updated ${updates.length} career records. Existing selections and text preserved. Reload any open CV editor.`);
  }
} finally { await client.close(); }
