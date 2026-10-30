export const CATEGORY_FIELDS = ["industries", "products"];

export async function getContactCategoryCatalog(db) {
  const entries = await Promise.all(CATEGORY_FIELDS.map(async (field) => {
    const rows = await db.collection(`contact_${field}`).find({}).sort({label: 1}).toArray();
    // Unlike contact selections, the shared catalog is not capped at 50 labels.
    return [field, [...new Map(rows.map(({label}) => {
      const formatted = formatCategoryLabel(label);
      return [formatted.toLowerCase(), formatted];
    })).values()].filter(Boolean)];
  }));
  return Object.fromEntries(entries);
}

export function formatCategoryLabel(value) {
  if (typeof value !== "string") return "";
  const label = value.normalize("NFKC").replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, 100);
  // Capitalize the label without damaging technical terms such as IIoT or IO-Link.
  return label.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("en"));
}

export function normalizeCategories(values) {
  if (!Array.isArray(values)) return [];
  const labels = new Map();
  for (const value of values.slice(0, 50)) {
    if (typeof value !== "string") continue;
    const label = formatCategoryLabel(value);
    if (label && !labels.has(label.toLowerCase())) labels.set(label.toLowerCase(), label);
  }
  return [...labels.values()];
}

export async function saveContactCategories(db, contact) {
  for (const field of CATEGORY_FIELDS) {
    if (!Object.hasOwn(contact, field)) continue;
    const collection = db.collection(`contact_${field}`);
    contact[field] = await Promise.all(normalizeCategories(contact[field]).map(async (label) => {
      const _id = label.toLowerCase();
      try { await collection.updateOne({_id}, {$set: {label}}, {upsert: true}); }
      catch (error) { if (error.code !== 11000) throw error; }
      const saved = await collection.findOne({_id});
      if (!saved) throw new Error("Unable to save contact category.");
      return formatCategoryLabel(saved.label);
    }));
  }
  return contact;
}
