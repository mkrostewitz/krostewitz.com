'use client';

import {useEffect, useRef, useState} from 'react';
import {createPortal} from 'react-dom';
import {Download, FileSpreadsheet, Upload, X} from 'lucide-react';
import {csvRows, spreadsheetLeads} from '../../lib/leadImport.mjs';
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
  const [fileName, setFileName] = useState('');
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
      if (!/\.(xlsx|csv)$/i.test(file.name) || file.size > 5_000_000) throw new Error('Choose an .xlsx or .csv file smaller than 5 MB.');
      let rows;
      if (/\.csv$/i.test(file.name)) rows = csvRows(await file.text());
      else {
        const {readSheet} = await import('read-excel-file/browser');
        rows = await readSheet(file);
      }
      const parsed = spreadsheetLeads(rows);
      setEntries(parsed);
      setSelected(parsed.filter(entry => !entry.error).map(entry => entry.row));
      setMessage(`${parsed.length} contacts found. Review names carefully: titles were removed and names were split automatically.`);
    } catch (error) {setMessage(error.message || 'Unable to read this spreadsheet.');}
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
        const errors = data.results.filter(result => result.status === 'error');
        if (!errors.length) {
          onClose();
          return;
        }
        setSelected(errors.map(result => result.row));
        setMessage(`${data.leads.length} imported; ${data.results.filter(result => result.status === 'duplicate').length} duplicates skipped; ${errors.length} errors.`);
      } else setMessage('Duplicate check complete. Only rows marked Ready to import will be added.');
    } catch (error) {setMessage(error.message); setReviewed(false);}
    finally {setBusy(false);}
  }
  const ready = results.filter(result => result.status === 'ready').length;
  return createPortal(
    <dialog ref={dialog} className={`${outreach.activityModal} ${outreach.importModal}`} aria-labelledby="import-leads-title" aria-describedby="import-leads-description"
      onCancel={event => {event.preventDefault(); if (!busy) onClose();}}>
      <header className={outreach.importHeader}>
        <div>
          <h2 id="import-leads-title">Import leads</h2>
          <p id="import-leads-description">Upload your spreadsheet, review the contacts, then check for duplicates before importing.</p>
        </div>
        <button type="button" className={styles.iconButton} aria-label="Close import" disabled={busy} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <section className={outreach.importUpload} aria-labelledby="import-file-label">
        <div className={outreach.importUploadHeading}>
          <FileSpreadsheet size={24} aria-hidden="true" />
          <div>
            <label id="import-file-label" htmlFor="import-leads-file">Excel or CSV spreadsheet</label>
            <p id="import-file-hint">.xlsx or .csv format · Maximum 5 MB</p>
          </div>
        </div>
        <div className={outreach.importFilePicker}>
          <div className={outreach.importFileControl}>
            <input id="import-leads-file" className={outreach.importFile} type="file" accept=".xlsx,.csv" aria-describedby="import-file-hint import-file-layout import-file-name" disabled={busy} onChange={event => {
              const file = event.target.files?.[0];
              setFileName(file?.name || '');
              void load(file);
            }} />
            <span className={outreach.importFileButton} aria-hidden="true"><Upload size={16} />{fileName ? 'Change spreadsheet' : 'Select spreadsheet'}</span>
          </div>
          <span id="import-file-name" className={outreach.importFileName} title={fileName}>{fileName || 'No spreadsheet selected'}</span>
        </div>
        <p id="import-file-layout" className={outreach.importHint}>Use the <strong>Leads.xlsx</strong> column layout: Firma, Ansprechpartner, Status, Datum, Tool, Nachverfolgung.</p>
        <div className={outreach.importTemplate}>
          <a className={`${styles.secondaryButton} ${styles.iconTextButton}`} href="/templates/leads-template.csv" download="leads-template.csv"><Download size={16} aria-hidden="true" />Download CSV template</a>
          <p className={outreach.importHint}>Replace the example rows with your contacts and keep the column headers. Use YYYY-MM-DD for dates; a date is required when Status contains activity text. Save CSV files as UTF-8.</p>
        </div>
      </section>
      <p className={outreach.importHint}>Existing contacts are skipped. Their details and activity stay intact.</p>
      {message && <p className={outreach.importMessage} role="status">{message}</p>}
      {entries.length > 0 && <div className={outreach.importRows}>
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
      </div>}
      <footer className={outreach.importActions}>
        <button type="button" className={styles.secondaryButton} disabled={busy} onClick={onClose}>Close</button>
        <button type="button" className={styles.button} disabled={busy || !selected.length || (reviewed && !ready)} onClick={() => void submit(reviewed)}>
          {busy ? 'Processing…' : reviewed ? `Import ${ready} leads` : 'Check for duplicates'}
        </button>
      </footer>
    </dialog>, document.body
  );
}
