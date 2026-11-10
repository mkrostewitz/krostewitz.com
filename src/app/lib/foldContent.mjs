export const FOLD_LIMITS = {title: 500, subtitle: 3000, usp: 3000};

export function validateFoldCopy(value, source) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Enter the Fold / Hero text first.');
  function check(text, limit, field) {
    if (typeof text !== 'string' || !text.trim() || text.length > limit) throw new Error(`Enter ${field} between 1 and ${limit} characters.`);
    if (/[<>]/.test(text.replace(/<\/?(?:span|strong|em|u|s)>|<br\s*\/?\s*>/gi, ''))) throw new Error('Unsupported text formatting. Use the editor toolbar to format your text.');
    if (!text.replace(/<[^>]*>/g, '').replace(/&nbsp;|&#160;|&#xA0;/gi, ' ').trim()) throw new Error(`Enter text for ${field}.`);
    return text.trim();
  }
  const copy = Object.fromEntries(Object.entries(FOLD_LIMITS).map(([field, limit]) => [field, check(value[field], limit, field)]));
  if (!Array.isArray(value.points) || value.points.length < 1 || value.points.length > 12) throw new Error('Enter between 1 and 12 offering points.');
  copy.points = value.points.map(point => check(point, 2000, 'each offering point'));
  if (source) {
    if (source.points.length !== copy.points.length) throw new Error('Translation did not preserve all offering points.');
    const tags = text => JSON.stringify(text.match(/<[^>]*>/g) || []);
    const originals = [source.title, source.subtitle, source.usp, ...source.points];
    [copy.title, copy.subtitle, copy.usp, ...copy.points].forEach((text, index) => {
      if (tags(text) !== tags(originals[index])) throw new Error('Translation did not preserve formatting.');
    });
  }
  return copy;
}

export function validateFoldTranslations(value) {
  return Object.fromEntries(['en', 'de'].map(language => {
    try {return [language, validateFoldCopy(value?.[language])];}
    catch (error) {throw new Error(`${language === 'en' ? 'English' : 'German'}: ${error.message}`);}
  }));
}

// Keep the hero inline while Tiptap uses paragraphs internally. Pasted
// paragraphs become line breaks, which fit inside the homepage heading.
export function foldInlineHtml(html = '') {
  return html.replace(/<\/p>\s*<p>/gi, '<br>').replace(/<\/?p>/gi, '').replace(/<br\s*\/?\s*>/gi, '<br>');
}

export function foldEditorHtml(html = '') {
  return `<p>${foldInlineHtml(html)}</p>`;
}
