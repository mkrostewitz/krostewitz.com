export function normalizeLeadSource(value) {
  if (typeof value !== "string" || value.length > 200 || /[\r\n\u0000]/.test(value)) throw new Error("Source must be a single text value of up to 200 characters.");
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export async function saveLeadSource(db, value) {
  const label = normalizeLeadSource(value);
  if (!label) return "";
  const collection = db.collection("lead_sources");
  const _id = label.toLowerCase();
  try { await collection.updateOne({_id}, {$setOnInsert: {label}}, {upsert: true}); }
  catch (error) { if (error.code !== 11000) throw error; }
  return (await collection.findOne({_id})).label;
}
