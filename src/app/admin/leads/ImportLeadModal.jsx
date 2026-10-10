'use client';

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {spreadsheetLeads} from '../../lib/leadImport.mjs';
import styles from '../admin.module.css';
import outreach from './outreach.module.css';

export default function ImportLeadModal({onClose, onImported}) {
  const dialog = useRef(null);
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const element = dialog.current;
    const previous = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = 'hidden';
    return () => {element.close(); document.body.style.overflow = previous;};
  }, []);

  async function load(file) {
    setEntries([]); setResults([]); setSelected([]); setReviewed(false); setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 5_000_000) throw new Error('Choose an .xlsx file smaller than 5 MB.');
      const {readSheet} = await import('read-excel-file');
      const parsed = spreadsheetLeads(await readSheet(file));
      setEntries(parsed);
      setSelected(parsed.filter(entry => !entry.error).map(entry => entry.row));
      setMessage(`${parsed.length} contacts found. Review names carefully: titles were removed and names were split automatically.`);
    } catch (error) {setMessage(error.message || 'Unable to read this Excel file.');}
    finally {setBusy(false);}
  }
  function edit(row, patch) {
    setEntries(current => current.map(entry => entry.row === row ? {...entry, ...patch, error: ''} : entry));
    setReviewed(false); setResults([]);
  }
  async function submit(commit) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/leads/import', {method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({commit, entries: entries.filter(entry => selected.includes(entry.row))})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to import leads.');
      setResults(data.results);
      setReviewed(!commit);
      if (commit) {
        onImported(data.leads);
        setSelected(data.results.filter(result => result.status === 'error').map(result => result.row));
        setMessage(`${data.leads.length} imported; ${data.results.filter(result => result.status === 'duplicate').length} duplicates skipped; ${data.results.filter(result => result.status === 'error').length} errors.`);
      } else setMessage('Duplicate check complete. Only rows marked Ready to import will be added.');
    } catch (error) {setMessage(error.message); setReviewed(false);}
    finally {setBusy(false);}
  }
  const ready = results.filter(result => result.status === 'ready').length;
  return createPortal(
    <dialog ref={dialog} className={`${outreach.activityModal} ${outreach.createModal}`} aria-labelledby="import-leads-title"
      onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
      <h2 id="import-leads-title">Import leads from Excel</h2>
      <p>Use the Leads.xlsx layout: Firma, Ansprechpartner, Status, Datum, Tool, Nachverfolgung. Existing contacts are skipped; their details and activity stay intact.</p>
      <label className={styles.field}>Excel file
        <input type="file" accept=".xlsx" disabled={busy} onChange={event => void load(event.target.files?.[0])} />
      </label>
      {message && <p role="status">{message}</p>}
      <div className={outreach.importRows}>
        {entries.map(entry => {
          const result = results.find(result => result.row === entry.row);
          return <fieldset key={entry.row} disabled={busy} className={outreach.importRow}>
            <legend>Row {entry.row} · {entry.contact.company || 'No company'}</legend>
            <label><input type="checkbox" checked={selected.includes(entry.row)} disabled={result?.status === 'imported'} onChange={event => {
              setSelected(current => event.target.checked ? [...current, entry.row] : current.filter(row => row !== entry.row));
              setReviewed(false);
            }} /> Include contact</label>
            <div className={outreach.grid}>
              <label className={styles.field}>First name<input value={entry.contact.firstName} onChange={event => edit(entry.row, {contact: {...entry.contact, firstName: event.target.value}})} /></label>
              <label className={styles.field}>Last name<input value={entry.contact.lastName} onChange={event => edit(entry.row, {contact: {...entry.contact, lastName: event.target.value}})} /></label>
              <label className={styles.field}>Activity<input value={entry.activityText} onChange={event => edit(entry.row, {activityText: event.target.value})} /></label>
              <label className={styles.field}>Activity date<input type="date" value={entry.occurredOn} onChange={event => edit(entry.row, {occurredOn: event.target.value})} /></label>
              <label className={styles.field}>Follow-up date<input type="date" value={entry.followUpOn} onChange={event => edit(entry.row, {followUpOn: event.target.value})} /></label>
              <p>Channel: {entry.channel || 'Other'}</p>
            </div>
            {(result || entry.error) && <p role="status">{result?.message || entry.error}</p>}
          </fieldset>;
        })}
      </div>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>Close</button>
        <button type="button" className={styles.button} disabled={busy || !selected.length || (reviewed && !ready)} onClick={() => void submit(reviewed)}>
          {busy ? 'Processing…' : reviewed ? `Import ${ready} leads` : 'Check selected contacts'}
        </button>
      </div>
    </dialog>, document.body
  );
}
