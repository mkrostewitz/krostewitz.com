export function normalizeEducationLanguages(input) {
  if (!Array.isArray(input) || input.length > 30) throw new Error('Use at most 30 languages.');
  const seen = new Set();
  return input.map(item => {
    const code = typeof item?.code === 'string' ? item.code.trim().toLowerCase() : '';
    if (code === 'cn') throw new Error('Chinese uses the language code zh. CN is the country code for China.');
    const names = new Intl.DisplayNames(['en'], {type: 'language', fallback: 'none'});
    if (!/^[a-z]{2,3}$/.test(code) || !names.of(code) || seen.has(code)) throw new Error('Each language needs a unique valid language code (e.g. en, de, zh).');
    seen.add(code);
    const translations = Object.fromEntries(['en', 'de'].map(language => {
      const source = item.translations?.[language] || {};
      if (['name', 'level'].some(field => typeof source[field] !== 'string' || !source[field].trim() || source[field].length > 100)) throw new Error('Add a language name and proficiency in English and German (up to 100 characters).');
      return [language, {name: source.name.trim(), level: source.level.trim()}];
    }));
    return {code, translations};
  });
}
export function seedEducationLanguages(translations) {
  const rows = translations.en?.executiveSummary?.languages?.list || [];
  return normalizeEducationLanguages(rows.map(row => ({code: row.code, translations: Object.fromEntries(['en', 'de'].map(language => {
    const match = translations[language]?.executiveSummary?.languages?.list?.find(item => item.code.toLowerCase() === row.code.toLowerCase()) || row;
    return [language, {name: match.name, level: match.level}];
  }))})));
}
export function localizeEducationLanguages(languages, language) {
  return languages.map(item => ({code: item.code.toUpperCase(), ...(item.translations[language] || item.translations.en)}));
}

export const EDUCATION_TYPES = {
  degree: 'University degree', vocational: 'Vocational qualification',
  certificate: 'Professional certificate', course: 'Course / continuing education',
  license: 'License / accreditation', school: 'School qualification', other: 'Other qualification',
};
export function normalizeEducationEntries(input = []) {
  if (!Array.isArray(input) || input.length > 100) throw new Error('Use at most 100 education entries.');
  const ids = new Set();
  const text = (value, limit) => {
    if (typeof value !== 'string' || value.length > limit) throw new Error(`Education text must be at most ${limit} characters.`);
    return value.trim();
  };
  return input.map(entry => {
    if (!entry || typeof entry.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(entry.id) || ids.has(entry.id)) throw new Error('Each education entry needs a unique ID.');
    ids.add(entry.id);
    if (!Object.hasOwn(EDUCATION_TYPES, entry.type)) throw new Error('Choose a qualification type.');
    if (typeof entry.published !== 'boolean') throw new Error('Choose whether to display this qualification.');
    const year = text(entry.year ?? '', 4);
    if (year && !/^[1-9]\d{3}$/.test(year)) throw new Error('Enter a four-digit completion year or leave it empty.');
    const url = text(entry.url ?? '', 2000);
    if (url) {
      try { const parsed = new URL(url); if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error(); }
      catch { throw new Error('Credential links must use HTTP or HTTPS.'); }
    }
    const translations = Object.fromEntries(['en', 'de'].map(language => {
      const source = entry.translations?.[language] || {};
      return [language, {title: text(source.title ?? '', 240), institution: text(source.institution ?? '', 240), detail: text(source.detail ?? '', 2000)}];
    }));
    if (!Object.values(translations).some(row => row.title)) throw new Error('Each qualification needs a title in at least one language.');
    return {id: entry.id, type: entry.type, published: entry.published, year, url, translations};
  });
}
export function publicEducationEntries(entries = [], language = 'en') {
  return entries.filter(entry => entry.published === true).map(entry => {
    const translation = entry.translations[language]?.title ? entry.translations[language] : Object.values(entry.translations).find(row => row.title);
    return {id: entry.id, type: entry.type, year: entry.year, url: entry.url, ...translation};
  });
}
