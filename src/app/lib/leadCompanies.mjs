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
