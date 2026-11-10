import 'server-only';
import {getDb} from './mongo';
import {getMergedTranslations} from './siteContent';
import {normalizeEducationEntries, normalizeEducationLanguages, seedEducationLanguages} from './educationData.mjs';
import {EDUCATION_COLLECTION, EDUCATION_DOCUMENT_ID, ensureEducation} from './educationStorage.mjs';
export async function getEducation() {
  const doc = await ensureEducation(await getDb(), async () => seedEducationLanguages(await getMergedTranslations()));
  return {languages: doc.languages, entries: doc.entries || [], revision: doc.revision};
}
export async function saveEducation(input, user) {
  const languages = normalizeEducationLanguages(input?.languages);
  // Older clients can still save languages without deleting qualifications.
  const entries = input?.entries === undefined ? undefined : normalizeEducationEntries(input.entries);
  if (!Number.isSafeInteger(input?.revision) || input.revision < 0) throw new Error('A valid education revision is required.');
  await getEducation();
  const result = await (await getDb()).collection(EDUCATION_COLLECTION).updateOne({_id: EDUCATION_DOCUMENT_ID, revision: input.revision}, {$set: {languages, ...(entries !== undefined ? {entries} : {}), updatedAt: new Date(), updatedBy: user.email}, $inc: {revision: 1}});
  if (!result.matchedCount) throw Object.assign(new Error('Education changed in another session. Reload before saving.'), {status: 409});
  return getEducation();
}
