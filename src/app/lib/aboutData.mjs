export function normalizeAbout(input, defaults = {}, {strict = false} = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const text = (value, limit) => String(value ?? '').trim().slice(0, limit);
  const photoUrl = text(source.photoUrl ?? defaults.photoUrl ?? '/about-me.jpg', 2000);
  if (photoUrl && !/^\/(?!\/)/.test(photoUrl) && !/^https:\/\//i.test(photoUrl)) {
    if (strict) throw new Error('The photo must use a relative path or an HTTPS URL.');
  }
  const translations = {};
  for (const language of ['en', 'de']) {
    const entry = source.translations?.[language] ?? defaults.translations?.[language] ?? {};
    if (strict && (!String(entry.headline || '').trim() || !String(entry.body || '').trim())) {
      throw new Error(`Enter the About headline and text for ${language.toUpperCase()}.`);
    }
    translations[language] = {
      headline: text(entry.headline, 500),
      body: text(entry.body, 20000),
      highlights: (Array.isArray(entry.highlights) ? entry.highlights : []).slice(0, 30).map(item => text(item, 1000)).filter(Boolean),
    };
  }
  return {
    photoUrl: photoUrl === '' || /^\/(?!\/)/.test(photoUrl) || /^https:\/\//i.test(photoUrl) ? photoUrl : '/about-me.jpg',
    photoAlt: text(source.photoAlt ?? defaults.photoAlt, 200),
    translations,
  };
}
