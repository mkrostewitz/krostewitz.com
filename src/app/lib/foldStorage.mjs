import {FOLD_ID, FOLD_LANGUAGES, validateFoldContent} from './foldContent.mjs';
import {foldSeed, foldDestinations} from './foldSeed.mjs';

export const FOLD_COLLECTION = 'site_content';

export async function ensureFold(db, defaults = {}) {
  const collection = db.collection(FOLD_COLLECTION);
  const existing = await collection.findOne({_id: FOLD_ID});
  if (existing) return existing;
  const legacy = await collection.findOne({_id: 'translations'});
  const content = structuredClone(foldSeed);
  const legacyOffers = {};
  for (const language of FOLD_LANGUAGES) {
    const previous = legacy?.translations?.[language] || defaults[language] || {};
    legacyOffers[language] = previous.offer || null;
    if (typeof previous.offer?.eyebrow === 'string' && !/[<>]/.test(previous.offer.eyebrow)) content.translations[language].eyebrow = previous.offer.eyebrow;
    for (const key of ['booking', 'linkedin']) {
      if (typeof previous.buttons?.[key] === 'string') content.translations[language].ctaLabels[key] = previous.buttons[key];
    }
  }
  const now = new Date();
  await collection.updateOne({_id: FOLD_ID}, {$setOnInsert: {
    ...validateFoldContent(content), destinations: foldDestinations,
    migration: {version: 1, migratedAt: now, legacyOffers},
    createdAt: now, updatedAt: now,
  }}, {upsert: true});
  return collection.findOne({_id: FOLD_ID});
}

export function publicFold(document) {
  return {...validateFoldContent(document), destinations: document.destinations || foldDestinations};
}

export async function saveFold(db, value, user, defaults = {}) {
  const content = validateFoldContent(value);
  await ensureFold(db, defaults);
  // Keep a snapshot with the write; imports never alter destination bindings.
  await db.collection(FOLD_COLLECTION).updateOne({_id: FOLD_ID}, [{$set: {
    previousContent: {showEyebrow: '$showEyebrow', translations: '$translations', updatedAt: '$updatedAt'},
    showEyebrow: {$literal: content.showEyebrow}, translations: {$literal: content.translations},
    updatedAt: '$$NOW', updatedBy: {$literal: user?.email || 'fold-migration'},
  }}]);
  return publicFold(await db.collection(FOLD_COLLECTION).findOne({_id: FOLD_ID}));
}
