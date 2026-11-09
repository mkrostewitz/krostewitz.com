import sanitizeHtml from 'sanitize-html';

export const TIMELINE_HTML_LIMIT = 50000;
export function sanitizeTimelineHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: ['p', 'br', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'blockquote', 'ul', 'ol', 'li', 'a'],
    allowedAttributes: {a: ['href', 'title'], ol: ['start']},
    allowedSchemes: ['https', 'http', 'mailto'], allowProtocolRelative: false,
    transformTags: {b: 'strong', i: 'em'},
  });
}
export function timelineHtmlText(html) {
  return sanitizeHtml(sanitizeTimelineHtml(html).replace(/<br\s*\/?\s*>|<\/(?:p|h3|h4|li|blockquote)>/gi, '\n'), {allowedTags: [], allowedAttributes: {}})
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\n{3,}/g, '\n\n').trim();
}
function escape(text) {
  return String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
export function timelineEditorHtml(translation, field) {
  const richField = field === 'detail' ? 'detailHtml' : 'highlightsHtml';
  if (translation[richField] !== undefined) return sanitizeTimelineHtml(translation[richField]);
  if (field === 'highlights') return (translation.highlights || []).length ? `<ul>${translation.highlights.map(item => `<li><p>${escape(item)}</p></li>`).join('')}</ul>` : '<p></p>';
  return `<p>${escape(translation.detail).replace(/\n/g, '<br>')}</p>`;
}
