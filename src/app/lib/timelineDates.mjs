const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export function validTimelineMonth(value) {
  return typeof value === 'string' && monthPattern.test(value) && Number(value.slice(0, 4)) > 0;
}
export function timelineDateInput(value) {
  return validTimelineMonth(value) ? `${value}-01` : value || '';
}
export function validTimelineDate(value) {
  if (validTimelineMonth(value)) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !validTimelineMonth(value.slice(0, 7))) return false;
  const date = new Date(0);
  date.setUTCFullYear(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8)));
  return date.toISOString().slice(0, 10) === value;
}
export function formatTimelinePeriod(dates, language = 'en') {
  const format = value => {
    if (!validTimelineDate(value)) return '';
    const date = new Date(0);
    date.setUTCFullYear(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, value.length === 10 ? Number(value.slice(8)) : 1);
    return new Intl.DateTimeFormat(language === 'de' ? 'de-DE' : 'en-US', {...(value.length === 10 ? {day: 'numeric'} : {}), month: 'short', year: 'numeric', timeZone: 'UTC'}).format(date);
  };
  return validTimelineDate(dates.startDate) && (dates.current || validTimelineDate(dates.endDate))
    ? `${format(dates.startDate)} — ${dates.current ? (language === 'de' ? 'Heute' : 'Present') : format(dates.endDate)}` : '';
}
// Only infer explicit months: year-only or unfamiliar periods need user review.
export function initialTimelineDates(entry) {
  if (entry.startDate !== undefined) return {startDate: entry.startDate, endDate: entry.endDate || '', current: Boolean(entry.current)};
  const months = {jan:1,january:1,januar:1,feb:2,february:2,februar:2,mar:3,march:3,mär:3,märz:3,apr:4,april:4,may:5,mai:5,jun:6,june:6,juni:6,jul:7,july:7,juli:7,aug:8,august:8,sep:9,sept:9,september:9,oct:10,october:10,okt:10,oktober:10,nov:11,november:11,dec:12,december:12,dez:12,dezember:12};
  const parse = text => {
    if (validTimelineMonth(text)) return text;
    const match = text.toLowerCase().match(/^([a-zä]+)\.?\s+(\d{4})$/);
    return match && months[match[1]] ? `${match[2]}-${String(months[match[1]]).padStart(2,'0')}` : '';
  };
  for (const translation of Object.values(entry.translations || {})) {
    const parts = (translation.period || '').split(/\s*[—–]\s*|\s+-\s+|\s+(?:to|bis)\s+/i);
    if (parts.length !== 2) continue;
    const startDate = parse(parts[0].trim());
    const current = /^(present|current|today|heute|aktuell|bis heute)$/i.test(parts[1].trim());
    const endDate = current ? '' : parse(parts[1].trim());
    if (startDate && (current || endDate)) return {startDate, endDate, current};
  }
  return {startDate:'', endDate:'', current:false};
}
