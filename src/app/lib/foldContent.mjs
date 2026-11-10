export const FOLD_ID = 'homepage-fold';
export const FOLD_LANGUAGES = ['en', 'de'];
export const FOLD_STYLES = ['primary', 'accent', 'muted'];

function plainText(value, label, limit, optional = false) {
  if (typeof value !== 'string' || (!optional && !value.trim()) || value.length > limit || /[<>]/.test(value)) {
    throw new Error(`${label}: enter ${optional ? 'up to' : '1–'} ${limit} characters of plain text.`);
  }
  return value;
}

export function validateFoldCopy(value, source) {
  if (!value || typeof value !== 'object') throw new Error('Enter the Fold content.');
  if (!Array.isArray(value.headline) || value.headline.length < 1 || value.headline.length > 12) throw new Error('Use 1–12 headline segments.');
  const headline = value.headline.map(segment => {
    if (!segment || !FOLD_STYLES.includes(segment.style) || typeof segment.breakBefore !== 'boolean') throw new Error('Choose a supported headline style and line break.');
    return {text: plainText(segment.text, 'Headline segment', 500), style: segment.style, breakBefore: segment.breakBefore};
  });
  if (headline.reduce((length, segment) => length + segment.text.length, 0) > 1000) throw new Error('Keep the headline within 1,000 characters.');
  if (!Array.isArray(value.cards) || value.cards.length !== 3) throw new Error('Enter exactly three competency cards.');
  const copy = {
    eyebrow: plainText(value.eyebrow, 'Eyebrow', 200, true),
    headline,
    subheadline: plainText(value.subheadline, 'Subheadline', 3000),
    statement: plainText(value.statement, 'Personal statement', 3000),
    cards: value.cards.map(card => ({title: plainText(card?.title, 'Card title', 200), description: plainText(card?.description, 'Card description', 2000)})),
    ctaLabels: {booking: plainText(value.ctaLabels?.booking, 'Booking label', 100), linkedin: plainText(value.ctaLabels?.linkedin, 'LinkedIn label', 100)},
  };
  if (source && (headline.length !== source.headline.length || headline.some((segment, index) => segment.style !== source.headline[index].style || segment.breakBefore !== source.headline[index].breakBefore))) {
    throw new Error('Translation did not preserve the headline structure.');
  }
  return copy;
}

export function validateFoldTranslations(value) {
  return Object.fromEntries(FOLD_LANGUAGES.map(language => {
    try {return [language, validateFoldCopy(value?.[language])];}
    catch (error) {throw new Error(`${language === 'en' ? 'English' : 'German'}: ${error.message}`);}
  }));
}

export function validateFoldContent(value) {
  if (typeof value?.showEyebrow !== 'boolean') throw new Error('Choose whether to show the eyebrow.');
  return {showEyebrow: value.showEyebrow, translations: validateFoldTranslations(value.translations)};
}

// Transfers contain editorial content only. Each environment keeps its own links.
export function exportFoldContent(value) {
  return {format: FOLD_ID, version: 1, content: validateFoldContent(value)};
}
export function importFoldContent(value) {
  if (value?.format !== FOLD_ID || value.version !== 1) throw new Error('Choose a version 1 homepage-fold export.');
  return validateFoldContent(value.content);
}
