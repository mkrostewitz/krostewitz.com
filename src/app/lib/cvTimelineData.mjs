import {validTimelineDate, timelineDateInput, formatTimelinePeriod} from "./timelineDates.mjs";
import {sanitizeTimelineHtml, timelineHtmlText, TIMELINE_HTML_LIMIT} from "./timelineRichText.mjs";

export const CV_TIMELINE_COLLECTION = "cv_timeline";
export const CV_TIMELINE_META_ID = "cv_timeline_settings";
export const TIMELINE_LANGUAGES = ["en", "de"];
export const TIMELINE_LIMITS = {period: 120, title: 240, company: 240, location: 240, detail: 10000};

export class TimelineError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function normalizeTimelineDocuments(documents = []) {
  if (!Array.isArray(documents) || documents.length > 10) throw new TimelineError("Attach at most 10 PDF documents per station.");
  const ids = new Set();
  return documents.map((doc) => {
    if (!doc || typeof doc.id !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(doc.id) || ids.has(doc.id)) throw new TimelineError("Every document needs a unique valid ID.");
    ids.add(doc.id);
    for (const [field, limit] of [["title", 200], ["fileName", 250], ["url", 2000]]) {
      if (typeof doc[field] !== "string" || !doc[field].trim() || doc[field].length > limit) throw new TimelineError(`Invalid document ${field}.`);
    }
    try {
      const url = new URL(doc.url);
      if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error();
    } catch { throw new TimelineError("Document URL must use HTTP or HTTPS."); }
    if (!["", ...TIMELINE_LANGUAGES].includes(doc.language || "")) throw new TimelineError("Choose a supported document language.");
    if (!Number.isInteger(doc.size) || doc.size <= 0 || doc.size > 10 * 1024 * 1024) throw new TimelineError("Documents must be PDFs up to 10 MB.");
    return {id: doc.id, title: doc.title.trim(), fileName: doc.fileName.trim(), url: doc.url.trim(), size: doc.size, language: doc.language || ""};
  });
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
    let dates = {};
    if (entry.startDate !== undefined) {
      if (!validTimelineDate(entry.startDate) || typeof entry.current !== "boolean" || (!entry.current && !validTimelineDate(entry.endDate))) throw new TimelineError("Choose a start date and an end date, or mark the position as current.");
      if (!entry.current && timelineDateInput(entry.endDate) < timelineDateInput(entry.startDate)) throw new TimelineError("End date must not be before start date.");
      dates = {startDate: entry.startDate, endDate: entry.current ? "" : entry.endDate, current: entry.current};
    }
    const translations = {};
    for (const language of TIMELINE_LANGUAGES) {
      const source = entry.translations?.[language] || {};
      const translation = {};
      for (const [field, limit] of Object.entries(TIMELINE_LIMITS)) {
        if (field === "company" && source.company === undefined) continue;
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
      for (const field of ["detailHtml", "highlightsHtml"]) {
        if (source[field] === undefined) continue;
        if (typeof source[field] !== "string" || source[field].length > TIMELINE_HTML_LIMIT) throw new TimelineError(`Rich text must be at most ${TIMELINE_HTML_LIMIT} characters.`);
        translation[field] = sanitizeTimelineHtml(source[field]);
        const plain = timelineHtmlText(translation[field]);
        if (field === "detailHtml") {
          if (plain.length > TIMELINE_LIMITS.detail) throw new TimelineError("Role description must be at most 10000 text characters.");
          translation.detail = plain;
        } else {
          const items = plain.split(/\n+/).filter(Boolean);
          if (items.length > 50 || items.some(item => item.length > 2000)) throw new TimelineError("Use at most 50 highlights, each up to 2,000 characters.");
          translation.highlights = items;
        }
      }
      if (dates.startDate) translation.period = formatTimelinePeriod(dates, language);
      translations[language] = translation;
    }
    if (!Object.values(translations).some((value) => value.title && value.period)) {
      throw new TimelineError("Each entry needs a title and period in at least one language.");
    }
    const documents = normalizeTimelineDocuments(entry.documents);
    return {id: entry.id, ...dates, translations, ...(documents.length ? {documents} : {})};
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
    return {id: entry.id, ...(entry.documents?.length ? {documents: entry.documents} : {}), ...(selected?.title && selected?.period ? selected : fallback), ...(entry.startDate ? {period: formatTimelinePeriod(entry, language)} : {})};
  });
}

// Metadata stays outside cv_timeline so every document in that collection is a career entry.
export async function readTimeline(db) {
  const documents = await db.collection(CV_TIMELINE_COLLECTION).find({_id: {$ne: "timeline"}}).sort({order: 1, _id: 1}).toArray();
  const meta = await db.collection("site_content").findOne({_id: CV_TIMELINE_META_ID});
  return {
    entries: documents.map(({_id, translations, documents, startDate, endDate, current}) => ({id: _id, ...(startDate ? {startDate, endDate, current} : {}), translations, ...(documents?.length ? {documents} : {})})),
    revision: meta?.revision || 0,
  };
}

export function timelineOperations(entries, audit = {}, insertOnly = false) {
  const now = new Date();
  return entries.map((entry, order) => ({updateOne: {
    filter: {_id: entry.id},
    update: insertOnly ? {$setOnInsert: {
      ...(entry.startDate ? {startDate: entry.startDate, endDate: entry.endDate, current: entry.current} : {}),
      order, translations: entry.translations, documents: entry.documents || [], createdAt: audit.createdAt || now,
      updatedAt: audit.updatedAt || now, updatedBy: audit.updatedBy || null,
    }} : {
      $set: {...(entry.startDate ? {startDate: entry.startDate, endDate: entry.endDate, current: entry.current} : {}), order, translations: entry.translations, documents: entry.documents || [], updatedAt: now, updatedBy: audit.updatedBy || null},
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
