import {normalizeCategories} from "./contactCategories.mjs";
import {normalizeAddress, formatAddress} from "./leadAddress.mjs";

function companyLabel(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

// Ignore casing and incidental spacing without merging different company names.
export function groupLeadsByCompany(leads) {
  const groups = new Map();
  for (const lead of leads) {
    const name = companyLabel(lead.company);
    const key = name.normalize("NFKC").toLowerCase();
    if (!groups.has(key)) groups.set(key, {key, name, leads: []});
    groups.get(key).leads.push(lead);
  }
  return [...groups.values()].sort((a, b) => {
    if (!a.key) return 1;
    if (!b.key) return -1;
    return a.name.localeCompare(b.name, "en", {sensitivity: "base", numeric: true});
  });
}

export function leadCompanySuggestions(leads) {
  return groupLeadsByCompany(leads).filter((group) => group.key).map((group) => group.name);
}

export const companyKey = value => companyLabel(value).normalize("NFKC").toLowerCase();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Only these fields belong to the company; identity, source and research stay personal.
export function companyDetails(contact = {}) {
  const applications = normalizeCategories(contact.applications ?? contact.industries);
  const address = contact.address ? normalizeAddress(contact.address) : null;
  return {website: contact.website || "", products: normalizeCategories(contact.products),
    applications, industries: applications, address,
    location: (address ? formatAddress(address) : contact.location) || ""};
}

export function mergeCompanyDetails(profile, contact, baseline) {
  const incoming = companyDetails(contact);
  if (!profile) return incoming;
  // Clients send the displayed baseline so unrelated saves cannot undo newer company edits.
  if (!baseline) return profile;
  const before = companyDetails(baseline);
  const merged = {...profile};
  for (const field of ['website', 'products', 'applications']) {
    if (!same(incoming[field], before[field])) merged[field] = incoming[field];
  }
  if (!same(incoming.address, before.address) || incoming.location !== before.location) {
    merged.address = incoming.address; merged.location = incoming.location;
  }
  merged.industries = merged.applications;
  return merged;
}
