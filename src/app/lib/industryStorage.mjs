import {formatCategoryLabel} from './contactCategories.mjs';
import defaults from './industryDefaults.mjs';

export const INDUSTRY_COLLECTION = 'experience_industries';
const MIGRATION_ID = 'experience_industries_v1';
import {INDUSTRY_ICONS} from './industryIcons.mjs';
export {INDUSTRY_ICONS} from './industryIcons.mjs';
const key = value => formatCategoryLabel(value).toLowerCase();

async function insert(collection, _id, fields) {
  try { await collection.updateOne({_id}, {$setOnInsert: fields}, {upsert: true}); }
  catch (error) { if (error.code !== 11000) throw error; }
}

// Copy once without changing legacy translations, contact tags or CV references.
// $setOnInsert makes retries safe and preserves any edits in the destination.
export async function ensureIndustries(db) {
  const meta = db.collection('site_content');
  if (await meta.findOne({_id: MIGRATION_ID})) return;
  const stored = await meta.findOne({_id: 'translations'});
  const cards = Object.fromEntries(['en', 'de'].map(language => [language,
    stored?.translations?.[language]?.skills?.industries ?? defaults[language]]));
  const legacy = await db.collection('contact_industries').find({}).toArray();
  const collection = db.collection(INDUSTRY_COLLECTION);
  const documents = new Map(legacy.map(row => [String(row._id), {
    label: row.label, translations: {en: {label: row.label, detail: ''}}, icon: '', order: 1000, revision: 0,
  }]));
  const count = Math.max(cards.en.length, cards.de.length);
  for (let index = 0; index < count; index++) {
    const english = cards.en[index];
    const german = cards.de[index];
    const label = english?.title || german?.title;
    if (!label) continue;
    const match = legacy.find(row => key(row.label) === key(label));
    const id = match ? String(match._id) : `industry-focus-${index}`;
    documents.set(id, {
      label, translations: Object.fromEntries(['en', 'de'].flatMap(language => {
        const card = cards[language][index];
        return card ? [[language, {label: card.title || '', detail: card.detail || ''}]] : [];
      })), icon: english?.icon || german?.icon || '', order: index, revision: 0,
    });
  }
  for (const [id, fields] of documents) await insert(collection, id, fields);
  await insert(meta, MIGRATION_ID, {completedAt: new Date()});
}

export function serializeIndustry({_id, label, translations, icon, order, revision}) {
  return {id: String(_id), label, translations: translations || {}, icon: icon || '', order: order ?? 1000, revision: revision ?? 0};
}

export async function getIndustries(db) {
  await ensureIndustries(db);
  return (await db.collection(INDUSTRY_COLLECTION).find({}).sort({order: 1, label: 1}).toArray()).map(serializeIndustry);
}

export async function createIndustry(db, input) {
  if (typeof input !== 'string' || !input.trim() || input.length > 100) throw new Error('Enter an industry of at most 100 characters.');
  const label = formatCategoryLabel(input);
  const existing = (await getIndustries(db)).find(row => key(row.label) === key(label) || Object.values(row.translations).some(item => key(item.label) === key(label)));
  if (existing) return existing;
  const id = key(label);
  const collection = db.collection(INDUSTRY_COLLECTION);
  await insert(collection, id, {label, translations: {en: {label, detail: ''}}, icon: '', order: 1000, revision: 0, createdAt: new Date()});
  return serializeIndustry(await collection.findOne({_id: id}));
}

export function normalizeIndustryEdit(input) {
  if (!input || typeof input.id !== 'string' || !input.id || input.id.length > 200 || !Number.isSafeInteger(input.revision) || input.revision < 0) throw new Error('Reload the industry before editing.');
  const translations = {};
  for (const language of ['en', 'de']) {
    const value = input.translations?.[language] || {};
    if (typeof value.label !== 'string' || value.label.length > 100 || typeof value.detail !== 'string' || value.detail.length > 4000) throw new Error('Use titles up to 100 characters and descriptions up to 4,000 characters.');
    translations[language] = {label: value.label.trim(), detail: value.detail.trim()};
  }
  if (!translations.en.label) throw new Error('Enter an English industry title.');
  if (input.icon !== '' && !INDUSTRY_ICONS.includes(input.icon)) throw new Error('Choose a valid icon.');
  return {label: translations.en.label, translations, icon: input.icon};
}

export async function updateIndustry(db, input, user) {
  const fields = normalizeIndustryEdit(input);
  await ensureIndustries(db);
  const collection = db.collection(INDUSTRY_COLLECTION);
  const result = await collection.updateOne({_id: input.id, revision: input.revision}, {$set: {...fields, updatedAt: new Date(), updatedBy: user?.email || null}, $inc: {revision: 1}});
  if (!result.matchedCount) throw Object.assign(new Error('This industry changed. Reload it before saving again.'), {status: 409});
  return serializeIndustry(await collection.findOne({_id: input.id}));
}

export function validateIndustryDelete(input) {
  if (!input || typeof input.id !== 'string' || !input.id || input.id.length > 200 || !Number.isSafeInteger(input.revision) || input.revision < 0) {
    throw Object.assign(new Error('Reload the industry before deleting.'), {status: 400});
  }
}

export async function deleteIndustry(db, input) {
  validateIndustryDelete(input);
  const assigned = await db.collection('cv_timeline').findOne({'classifications.industries': input.id});
  if (assigned) {
    const role = assigned.translations?.en;
    const name = [role?.company, role?.title].filter(Boolean).join(' — ');
    throw Object.assign(new Error(`This industry is assigned to ${name || 'an Experience role'}. Remove or replace it in all assigned roles before deleting.`), {status: 409});
  }
  const result = await db.collection(INDUSTRY_COLLECTION).deleteOne({_id: input.id, revision: input.revision});
  if (!result.deletedCount) throw Object.assign(new Error('This industry changed or was already deleted. Reload the list before trying again.'), {status: 409});
}
