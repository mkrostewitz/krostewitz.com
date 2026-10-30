import {OutreachValidationError} from "./leadOutreach.mjs";

export function normalizeLeadType(value) {
  if (value == null) return "";
  if (typeof value !== "string") throw new OutreachValidationError("Enter a valid lead type.");
  const label = value.normalize("NFKC").replace(/\u0000/g, "").replace(/\s+/g, " ").trim();
  if (label.length > 100) throw new OutreachValidationError("Lead type must be 100 characters or fewer.");
  return label;
}

// A separate catalog retains types even when their last lead is removed.
export async function saveLeadType(collection, value) {
  const label = normalizeLeadType(value);
  if (!label) return "";
  const _id = label.toLowerCase();
  try {
    await collection.updateOne({_id}, {$setOnInsert: {label}}, {upsert: true});
  } catch (error) {
    // Another request may have created the same type concurrently.
    if (error.code !== 11000) throw error;
  }
  const saved = await collection.findOne({_id});
  if (!saved) throw new Error("Unable to save lead type.");
  return saved.label;
}

export function getLeadTypes(lead) {
  return Array.isArray(lead?.leadTypes) ? lead.leadTypes : lead?.leadType ? [lead.leadType] : [];
}

export function normalizeLeadTypes(values) {
  if (!Array.isArray(values) || values.length > 50) {
    throw new OutreachValidationError("Choose up to 50 lead tags.");
  }
  const unique = new Map();
  for (const value of values) {
    const label = normalizeLeadType(value);
    if (label && !unique.has(label.toLowerCase())) unique.set(label.toLowerCase(), label);
  }
  return [...unique.values()];
}

export async function saveLeadTypes(collection, values) {
  return Promise.all(normalizeLeadTypes(values).map((value) => saveLeadType(collection, value)));
}
