export const CV_TIMELINE_COLLECTION = "cv_timeline";
export const CV_TIMELINE_META_ID = "cv_timeline_settings";
export const TIMELINE_LANGUAGES = ["en", "de"];
export const TIMELINE_LIMITS = {period: 120, title: 240, location: 240, detail: 10000};

export class TimelineError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeTimeline(entries) {
  if (!Array.isArray(entries) || entries.length > 100) {
    throw new TimelineError("Timeline must be a list of at most 100 entries.");
  }
  const ids = new Set();
  return entries.map((entry) => {
    if (!entry || typeof entry.id !== "string" || entry.id === "timeline" || !/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id) || ids.has(entry.id)) {
      throw new TimelineError("Every entry must have a unique, valid ID.");
    }
    ids.add(entry.id);
    const translations = {};
    for (const language of TIMELINE_LANGUAGES) {
      const source = entry.translations?.[language] || {};
      const translation = {};
      for (const [field, limit] of Object.entries(TIMELINE_LIMITS)) {
        const value = source[field] ?? "";
        if (typeof value !== "string" || value.length > limit) {
          throw new TimelineError(`${language}: ${field} must be text of at most ${limit} characters.`);
        }
        translation[field] = value.trim();
      }
      const highlights = source.highlights ?? [];
      if (!Array.isArray(highlights) || highlights.length > 50 || highlights.some((value) => typeof value !== "string" || value.length > 2000)) {
        throw new TimelineError("Use at most 50 highlights, each up to 2,000 characters.");
      }
      translation.highlights = highlights.map((value) => value.trim()).filter(Boolean);
      translations[language] = translation;
    }
    if (!Object.values(translations).some((value) => value.title && value.period)) {
      throw new TimelineError("Each entry needs a title and period in at least one language.");
    }
    return {id: entry.id, translations};
  });
}

export function seedTimelineEntries(translations) {
  const count = Math.max(...TIMELINE_LANGUAGES.map((language) => translations[language]?.timeline?.length || 0));
  return normalizeTimeline(Array.from({length: count}, (_, index) => ({
    id: `entry-${index + 1}`,
    translations: Object.fromEntries(TIMELINE_LANGUAGES.map((language) => [language, translations[language]?.timeline?.[index] || {}])),
  })));
}

export function localizeTimeline(entries, language) {
  return entries.map((entry) => {
    const fallback = TIMELINE_LANGUAGES.map((code) => entry.translations[code]).find((value) => value?.title && value?.period);
    const selected = entry.translations[language];
    return {id: entry.id, ...(selected?.title && selected?.period ? selected : fallback)};
  });
}

// Metadata stays outside cv_timeline so every document in that collection is a career entry.
export async function readTimeline(db) {
  const documents = await db.collection(CV_TIMELINE_COLLECTION).find({_id: {$ne: "timeline"}}).sort({order: 1, _id: 1}).toArray();
  const meta = await db.collection("site_content").findOne({_id: CV_TIMELINE_META_ID});
  return {
    entries: documents.map(({_id, translations}) => ({id: _id, translations})),
    revision: meta?.revision || 0,
  };
}

export function timelineOperations(entries, audit = {}, insertOnly = false) {
  const now = new Date();
  return entries.map((entry, order) => ({updateOne: {
    filter: {_id: entry.id},
    update: insertOnly ? {$setOnInsert: {
      order, translations: entry.translations, createdAt: audit.createdAt || now,
      updatedAt: audit.updatedAt || now, updatedBy: audit.updatedBy || null,
    }} : {
      $set: {order, translations: entry.translations, updatedAt: now, updatedBy: audit.updatedBy || null},
      $setOnInsert: {createdAt: now},
    },
    upsert: true,
  }}));
}

export async function ensureTimeline(db, defaults) {
  const collection = db.collection(CV_TIMELINE_COLLECTION);
  const settings = db.collection("site_content");
  const meta = await settings.findOne({_id: CV_TIMELINE_META_ID});
  if (meta) {
    await collection.deleteOne({_id: "timeline"});
    return readTimeline(db);
  }

  const existing = await collection.findOne({_id: "timeline"});
  const documents = await collection.find({_id: {$ne: "timeline"}}).toArray();
  let entries;
  if (existing) {
    entries = normalizeTimeline(existing.entries);
  } else if (documents.length) {
    // An imported collection is authoritative, even without local metadata.
    entries = [];
  } else {
    const legacy = await settings.findOne({_id: "translations"});
    const translations = Object.fromEntries(TIMELINE_LANGUAGES.map((language) => [language, {
      timeline: legacy?.translations?.[language]?.timeline ?? defaults[language].timeline,
    }]));
    entries = seedTimelineEntries(translations);
  }
  const operations = timelineOperations(entries, existing || {}, true);
  if (operations.length) await collection.bulkWrite(operations, {ordered: true});
  // Delete only after all individual entries have been persisted. Insert-only
  // writes make retrying an interrupted migration safe for existing entries.
  await settings.updateOne({_id: CV_TIMELINE_META_ID}, {$setOnInsert: {
    revision: existing?.revision || 0, initializedAt: new Date(),
  }}, {upsert: true});
  if (existing) await collection.deleteOne({_id: "timeline"});
  return readTimeline(db);
}
