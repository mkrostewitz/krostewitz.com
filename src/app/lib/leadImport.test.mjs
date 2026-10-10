import test from 'node:test';
import assert from 'node:assert/strict';
import {spreadsheetLeads, normalizeImportEntry, importDay, importIdentity} from './leadImport.mjs';
const header = [null,'Firma','Ansprechpartner','Status','Datum','Tool','Nachverfolgung'];
const row = [null,'Example Co','Herr Ada Lovelace','Kontaktanfrage geschickt',46303,'LinkedIn',46308];
test('finds German headers below title rows and ignores template rows', () => {
  const entries = spreadsheetLeads([[null,46303],[],header,row,[null,null,null,'Status',null,'Tool']]);
  assert.equal(entries.length,1);
  assert.equal(entries[0].row,4);
  assert.deepEqual(entries[0].contact,{firstName:'Ada',lastName:'Lovelace',company:'Example Co'});
  assert.equal(entries[0].occurredOn,'2026-10-08');
  assert.equal(entries[0].followUpOn,'2026-10-13');
  assert.equal(normalizeImportEntry(entries[0]).action.type,'connection_requested');
});
test('handles Date cells and German text dates without local timezone shifts', () => {
  assert.equal(importDay(new Date('2026-10-08T00:00:00Z')),'2026-10-08');
  assert.equal(importDay('8.10.2026'),'2026-10-08');
  assert.throws(()=>importDay('31.2.2026'));
});
test('maps acceptance and followup activity and suggests five days only with a date', () => {
  for (const [status,type] of [['Kontaktanfrage bestätigt','connection_accepted'],['Nachgefasst','follow_up']]) {
    const input=[...row];input[3]=status;input[6]=null;
    const entry=spreadsheetLeads([header,input])[0];
    assert.equal(normalizeImportEntry(entry).action.type,type);
    assert.equal(entry.followUpOn,'2026-10-13');
  }
  const input=[...row];input[3]='Status';input[4]=null;input[6]=null;
  const entry=spreadsheetLeads([header,input])[0];
  assert.equal(normalizeImportEntry(entry).action,null);
  assert.equal(entry.followUpOn,'');
});
test('retains unknown status as a note and rejects undated activities', () => {
  const input=[...row];input[3]='Sent a profile';
  assert.equal(normalizeImportEntry(spreadsheetLeads([header,input])[0]).action.type,'note');
  input[4]=null;
  assert.match(spreadsheetLeads([header,input])[0].error,/date is required/);
});
test('does not invent a first name for a single-word contact', () => {
  const input=[...row];input[2]='Frau Example';
  assert.equal(spreadsheetLeads([header,input])[0].contact.firstName,'');
  assert.equal(spreadsheetLeads([header,input])[0].contact.lastName,'Example');
});
test('rejects unrelated sheets and normalizes duplicate identities', () => {
  assert.throws(()=>spreadsheetLeads([['Tool','Status']]),/Expected columns/);
  assert.equal(importIdentity({name:' Ada  Lovelace ',company:'EXAMPLE'}),importIdentity({name:'ada lovelace',company:'example'}));
});
