export function normalizeLeadPhotoUrl(value) {
  if (value == null || value === '') return '';
  if (typeof value !== 'string' || value.length > 8000) throw new Error('Enter a valid HTTPS profile photo URL.');
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Enter a valid HTTPS profile photo URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Enter a valid HTTPS profile photo URL.');
  return url.href;
}
