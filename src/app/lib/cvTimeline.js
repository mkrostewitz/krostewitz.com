import "server-only";

import {resources} from "../../lib/translationResources";
import {getDb} from "./mongo";
import {CV_TIMELINE_COLLECTION, CV_TIMELINE_META_ID, timelineOperations, ensureTimeline, normalizeTimeline, TimelineError} from "./cvTimelineData.mjs";

export async function getCvTimeline() {
  const db = await getDb();
  const document = await ensureTimeline(db, Object.fromEntries(Object.entries(resources).map(([language, value]) => [language, value.translation])));
  return {entries: document.entries, revision: document.revision};
}

export async function saveCvTimeline(input, user) {
  const entries = normalizeTimeline(input?.entries);
  if (!Number.isSafeInteger(input?.revision) || input.revision < 0) {
    throw new TimelineError("A valid timeline revision is required.");
  }
  const db = await getDb();
  const result = await db.collection("site_content").updateOne(
    {_id: CV_TIMELINE_META_ID, timelineOperations, revision: input.revision},
    {$set: {updatedAt: new Date(), updatedBy: user.email}, $inc: {revision: 1}}
  );
  if (!result.matchedCount) throw new TimelineError("The timeline changed in another session. Reload before saving again.", 409);
  const collection = db.collection(CV_TIMELINE_COLLECTION);
  const operations = timelineOperations(entries, {updatedBy: user.email});
  if (operations.length) await collection.bulkWrite(operations, {ordered: true});
  await collection.deleteMany({_id: {$nin: entries.map((entry) => entry.id)}});
  return {entries, revision: input.revision + 1};
}
