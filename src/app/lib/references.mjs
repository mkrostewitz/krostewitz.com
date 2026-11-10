export const REFERENCE_LANGUAGES = ["en", "de"];
export const REFERENCE_TEXT_LIMITS = {role: 240, relationship: 300, quote: 10000};

export function normalizeReferenceTranslation(input = {}, {strict = false} = {}) {
  if (strict && (!input || typeof input !== "object" || Array.isArray(input))) throw new Error("Invalid reference translation.");
  return Object.fromEntries(Object.entries(REFERENCE_TEXT_LIMITS).map(([field, limit]) => [field, text(input?.[field], limit, field, strict)]));
}

export function localizeReference(item, language) {
  const code = String(language || "en").toLowerCase().split("-")[0];
  const original = item.sourceLanguage || "en";
  if (code === original) return item;
  const translation = item.translations?.[code];
  return {...item, ...Object.fromEntries(Object.keys(REFERENCE_TEXT_LIMITS).map(field => [field, translation?.[field]?.trim() || item[field] || ""]))};
}

export const MAX_REFERENCES = 50;

// Clean display-only metadata; never change stored recommendations or translations.
export function referencePresentation(item) {
  let linkedinUrl = item.linkedinUrl;
  const role = (item.role || "").replace(/https?:\/\/(?:www\.)?linkedin\.com\/[^\s<>"']+/gi, match => {
    const link = url(match, "LinkedIn profile", false, true);
    if (!link) return match;
    linkedinUrl ||= link;
    return "";
  }).trim();
  return {...item, role, linkedinUrl};
}

function text(value, max, label, strict) {
  const result = typeof value === "string" ? value.trim() : "";
  if (strict && result.length > max) throw new Error(`${label} is too long (maximum ${max} characters).`);
  return result.slice(0, max);
}

function url(value, label, strict, linkedin = false) {
  const result = text(value, 2000, label, strict);
  if (!result) return "";
  try {
    const parsed = new URL(result);
    if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error();
    if (linkedin && !/^(www\.)?linkedin\.com$/i.test(parsed.hostname)) throw new Error();
    return parsed.href;
  } catch {
    if (strict) throw new Error(`${label} must be a valid ${linkedin ? "LinkedIn " : "HTTP or HTTPS "}URL.`);
    return "";
  }
}

export function normalizeReferences(input = {}, {strict = false} = {}) {
  if (strict && (!input || typeof input !== "object" || !Array.isArray(input.items))) throw new Error("References must contain a list of entries.");
  const source = Array.isArray(input?.items) ? input.items : [];
  if (strict && source.length > MAX_REFERENCES) throw new Error(`You can add up to ${MAX_REFERENCES} references.`);
  if (strict && !["cards", "carousel"].includes(input.mode)) throw new Error("Choose cards or carousel.");
  const ids = new Set();
  const items = source.slice(0, MAX_REFERENCES).map((entry, index) => {
    const row = entry || {};
    const item = {
      sourceLanguage: REFERENCE_LANGUAGES.includes(row.sourceLanguage) ? row.sourceLanguage : "en",
      translations: {},
      id: text(row.id, 80, "ID", strict) || `reference-${index}`,
      name: text(row.name, 160, "Name", strict),
      role: text(row.role, 240, "Role", strict),
      company: text(row.company, 240, "Company", strict),
      quote: text(row.quote, 10000, "Recommendation", strict),
      relationship: text(row.relationship, 300, "Relationship", strict),
      date: text(row.date, 10, "Date", strict),
      photoUrl: url(row.photoUrl, "Photo", strict),
      linkedinUrl: url(row.linkedinUrl, "LinkedIn profile", strict, true),
    };
    if (strict && row.sourceLanguage && !REFERENCE_LANGUAGES.includes(row.sourceLanguage)) throw new Error("Choose a supported original language.");
    for (const language of REFERENCE_LANGUAGES) {
      if (row.translations?.[language] !== undefined) item.translations[language] = normalizeReferenceTranslation(row.translations[language], {strict});
    }
    if (strict && (!item.name || !item.quote)) throw new Error(`Reference ${index + 1} needs a name and recommendation.`);
    if (item.date && (!/^\d{4}-\d{2}-\d{2}$/.test(item.date) || !Number.isFinite(Date.parse(item.date)) || new Date(item.date).toISOString().slice(0, 10) !== item.date)) {
      if (strict) throw new Error("Enter a valid recommendation date.");
      item.date = "";
    }
    if (ids.has(item.id)) {
      if (strict) throw new Error("Reference IDs must be unique.");
      item.id = `reference-${index}-${item.id}`;
    }
    ids.add(item.id);
    return item;
  }).filter((item) => item.name && item.quote);
  return {mode: input?.mode === "carousel" ? "carousel" : "cards", items};
}

export function publicReferences(profile) {
  const references = normalizeReferences(profile.references);
  return profile.referencesEnabled === true ? references : {...references, items: []};
}
