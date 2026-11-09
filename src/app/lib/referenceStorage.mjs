import {normalizeReferences} from './references.mjs';

export const REFERENCES_COLLECTION = 'references';
const PROFILE_ID = 'profile_settings';

export async function ensureReferences(db) {
  const profile = await db.collection('site_content').findOne({_id: PROFILE_ID});
  const entries = await db.collection(REFERENCES_COLLECTION).find({}).sort({order: 1, _id: 1}).toArray();
  return {...normalizeReferences({mode: profile?.referencesMode, items: entries}), enabled: profile?.referencesEnabled === true};
}

export async function saveReferences(db, changes, user) {
  const now = new Date();
  const settings = {};
  if (Object.hasOwn(changes, 'references')) {
    const references = normalizeReferences(changes.references, {strict: true});
    const collection = db.collection(REFERENCES_COLLECTION);
    // Each recommendation owns its document, translations and position.
    for (const [order, item] of references.items.entries()) {
      await collection.updateOne({_id: `reference:${item.id}`}, {
        $set: {...item, order, updatedAt: now, updatedBy: user?.email || null},
        $setOnInsert: {createdAt: now},
      }, {upsert: true});
    }
    await collection.deleteMany({_id: {$nin: references.items.map(item => `reference:${item.id}`)}});
    settings.referencesMode = references.mode;
  }
  if (Object.hasOwn(changes, 'referencesEnabled')) settings.referencesEnabled = changes.referencesEnabled === true;
  if (Object.keys(settings).length) {
    await db.collection('site_content').updateOne({_id: PROFILE_ID}, {$set: settings}, {upsert: true});
  }
  return ensureReferences(db);
}

export function withReferences(profile, stored) {
  return {...profile, references: normalizeReferences(stored), referencesEnabled: stored.enabled === true};
}

