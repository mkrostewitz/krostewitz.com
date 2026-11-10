export const EDUCATION_COLLECTION = 'education';
export const EDUCATION_DOCUMENT_ID = 'education_settings';

// The destination is authoritative, including deliberately empty lists. Keep
// the legacy document as a migration backup; never synchronize it back.
export async function ensureEducation(db, seedLanguages) {
  const collection = db.collection(EDUCATION_COLLECTION);
  const existing = await collection.findOne({_id: EDUCATION_DOCUMENT_ID});
  if (existing) return existing;
  const legacy = await db.collection('site_content').findOne({_id: EDUCATION_DOCUMENT_ID});
  const document = legacy || {languages: await seedLanguages(), entries: [], revision: 0};
  const {_id: legacyId, ...fields} = document;
  void legacyId;
  try {
    await collection.updateOne({_id: EDUCATION_DOCUMENT_ID}, {$setOnInsert: fields}, {upsert: true});
  } catch (error) {
    // Concurrent first reads may both try to create the singleton.
    if (error.code !== 11000) throw error;
  }
  const saved = await collection.findOne({_id: EDUCATION_DOCUMENT_ID});
  if (!saved) throw new Error('Unable to initialize education storage.');
  return saved;
}
