export function validateAboutTranslation(value, source) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter the About text first.');
  for (const [field, limit] of [['headline', 500], ['body', 20000]]) {
    if (typeof value[field] !== 'string' || !value[field].trim() || value[field].length > limit) {
      throw new Error(`Enter a ${field} between 1 and ${limit} characters.`);
    }
  }
  if (!Array.isArray(value.highlights) || value.highlights.length > 30 || value.highlights.some(item => typeof item !== 'string' || !item.trim() || item.length > 1000)) {
    throw new Error('Use up to 30 non-empty highlights, each at most 1,000 characters.');
  }
  if (source) {
    if (source.highlights.length !== value.highlights.length) throw new Error('Translation did not preserve all highlights.');
    const tags = text => JSON.stringify(text.match(/<[^>]*>/g) || []);
    for (const field of ['headline', 'body']) {
      if (tags(source[field]) !== tags(value[field])) throw new Error('Translation did not preserve formatting.');
    }
    for (const [index, highlight] of source.highlights.entries()) {
      if (tags(highlight) !== tags(value.highlights[index])) throw new Error('Translation did not preserve formatting.');
    }
  }
  return {headline: value.headline, body: value.body, highlights: [...value.highlights]};
}
