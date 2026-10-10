import {normalizeContact, normalizeActivity, normalizeDay, addDays} from './leadOutreach.mjs';

const text = value => String(value ?? '').trim();
export function csvRows(source) {
  const input = source.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [], field = '', quoted = false, afterQuote = false;
  // Excel may use semicolons in locales that use a decimal comma.
  const firstLine = input.split(/\r?\n/, 1)[0];
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const cell = () => {row.push(field); field = ''; afterQuote = false;};
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (quoted) {
      if (char !== '"') field += char;
      else if (input[index + 1] === '"') {field += '"'; index++;}
      else {quoted = false; afterQuote = true;}
    } else if (char === delimiter) cell();
    else if (char === '\n' || char === '\r') {
      cell(); rows.push(row); row = [];
      if (char === '\r' && input[index + 1] === '\n') index++;
    } else if (char === '"' && !field && !afterQuote) quoted = true;
    else {
      if (afterQuote || char === '"') throw new Error('Invalid CSV quoting. Save the file as CSV and try again.');
      field += char;
    }
  }
  if (quoted) throw new Error('An unclosed quote was found in the CSV file.');
  if (field || row.length || afterQuote) {cell(); rows.push(row);}
  return rows;
}
export const importIdentity = contact => [contact.name, contact.company].map(value => text(value).normalize('NFKC').toLowerCase().replace(/\s+/g, ' ')).join('|');
export function importDay(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return normalizeDay(value.toISOString().slice(0, 10));
  if (typeof value === 'number') return normalizeDay(new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000).toISOString().slice(0, 10));
  const raw = text(value);
  const match = raw.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return normalizeDay(match ? `${match[3]}-${match[2].padStart(2,'0')}-${match[1].padStart(2,'0')}` : raw);
}
export function spreadsheetLeads(rows) {
  const header = rows.findIndex(row => row.some(v => text(v) === 'Ansprechpartner') && row.some(v => text(v) === 'Firma'));
  if (header < 0) throw new Error('Expected columns: Firma, Ansprechpartner, Status, Datum, Tool, Nachverfolgung.');
  const columns = rows[header].map(text);
  const get = (row, key) => row[columns.indexOf(key)];
  const entries = [];
  rows.slice(header + 1).forEach((row, index) => {
    const name = text(get(row, 'Ansprechpartner'));
    const company = text(get(row, 'Firma'));
    if (!name && !company) return;
    const parts = name.replace(/^(Herrn?|Frau)\s+/i, '').split(/\s+/);
    const entry = {row: header + index + 2, contact: {firstName: parts.length > 1 ? parts.shift() : '', lastName: parts.join(' '), company}, activityText: text(get(row, 'Status')), channel: text(get(row, 'Tool')), occurredOn: '', followUpOn: '', error: ''};
    try {
      entry.occurredOn = importDay(get(row, 'Datum')) || '';
      entry.followUpOn = importDay(get(row, 'Nachverfolgung')) || (entry.occurredOn ? addDays(entry.occurredOn, 5) : '');
      normalizeImportEntry(entry);
    } catch (error) { entry.error = error.message; }
    entries.push(entry);
  });
  if (!entries.length) throw new Error('No contacts found in this worksheet.');
  if (entries.length > 500) throw new Error('Import up to 500 contacts at a time.');
  return entries;
}
export function normalizeImportEntry(entry) {
  const contact = normalizeContact(entry.contact);
  const raw = text(entry.activityText);
  const activityText = raw === 'Status' ? '' : raw;
  const channels = {linkedin:'linkedin', 'direct message':'linkedin', 'contact request':'linkedin', email:'email', telefon:'phone', phone:'phone'};
  const channel = channels[text(entry.channel).toLowerCase()] || 'other';
  const types = {'Kontaktanfrage geschickt':'connection_requested', 'Kontaktanfrage bestätigt':'connection_accepted', 'Nachgefasst':'follow_up'};
  if (activityText && !entry.occurredOn) throw new Error('An activity date is required for this status.');
  const action = activityText ? normalizeActivity({type: types[activityText] || 'note', channel, occurredOn: entry.occurredOn, text: activityText}) : null;
  return {contact, action, preferredChannel: channel, followUpOn: normalizeDay(entry.followUpOn || null), followUpTask: ''};
}
