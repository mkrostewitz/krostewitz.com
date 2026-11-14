import {formatCategoryLabel, normalizeCategories} from './contactCategories.mjs';

export function storedLeadLanguage(lead = {}) {
  const value = lead.contact?.language || lead.language || lead.source?.context?.language || lead.source?.context?.cvLanguage || lead.tracking?.language;
  return String(value || '').toLowerCase().split('-')[0] === 'de' ? 'de' : 'en';
}

// Keep canonical labels in shared company records; localize only the outgoing snapshot.
export async function getCategoryTranslations(db) {
  const result = {};
  for (const kind of ['products', 'applications', 'industries']) {
    result[kind] = (await db.collection(`lead_${kind}`).find({}).sort({label: 1}).toArray())
      .map(row => ({kind, label: row.label, translations: {en: row.label, ...row.translations}}));
  }
  return result;
}

export function normalizeCategoryTranslation(input) {
  if (!['products', 'applications', 'industries'].includes(input?.kind)) throw new Error('Choose products or industry & applications.');
  if (typeof input.label !== 'string' || !input.label.trim() || input.label.length > 100) throw new Error('Choose a valid canonical label.');
  const translations = {};
  for (const language of ['en', 'de']) {
    const value = input.translations?.[language];
    if (typeof value !== 'string' || value.length > 100 || /[\u0000\r\n]/.test(value)) throw new Error('Use translations of up to 100 characters.');
    translations[language] = value.trim();
  }
  if (!translations.en || !translations.de) throw new Error('Enter both English and German translations.');
  return {kind: input.kind, label: formatCategoryLabel(input.label), translations};
}

export function localizeCompanyCategories(contact, catalog, language = 'en') {
  language = contact.language || language;
  const result = {...contact};
  const missing = [];
  for (const kind of ['products', 'applications']) {
    const values = kind === 'applications' ? [...(contact.applications || []), ...(contact.industries || [])] : contact.products;
    if (!values) continue;
    if (kind === 'applications' && !Object.hasOwn(contact, 'applications') && !Object.hasOwn(contact, 'industries')) continue;
    const rows = kind === 'applications' ? [...(catalog.applications || []), ...(catalog.industries || [])] : catalog.products || [];
    result[kind] = normalizeCategories(values).map(label => {
      const row = rows.find(item => formatCategoryLabel(item.label).toLowerCase() === label.toLowerCase());
      const translated = row?.translations?.[language]?.trim();
      if (translated) return translated;
      if (language !== 'en') missing.push(label);
      return label;
    });
  }
  if (missing.length) throw Object.assign(new Error(`Missing ${language.toUpperCase()} translations: ${[...new Set(missing)].join(', ')}. Edit the terms using the pencil on their chips or Products & industries before syncing.`), {status: 400});
  return result;
}
