'use client';

import { Dialog, DialogContent, Typography, Alert } from "@mui/material";
import { LeadIconButton, LeadButton, LeadCheckbox, LeadField, LeadScope } from "./LeadUi";
import { useState } from 'react';
import { Download, FileSpreadsheet, Upload, X } from 'lucide-react';
import { csvRows, spreadsheetLeads } from '../../lib/leadImport.mjs';
import { useSnackbar } from './LeadSnackbar';
import outreach from './outreach.module.css';
export default function ImportLeadModal({
  onClose,
  onImported
}) {
  const {
    showSnackbar
  } = useSnackbar();
  const [entries, setEntries] = useState([]);
  const [selected, setSelected] = useState([]);
  const [results, setResults] = useState([]);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [fileName, setFileName] = useState('');
  async function load(file) {
    setEntries([]);
    setResults([]);
    setSelected([]);
    setReviewed(false);
    setMessage('');
    if (!file) return;
    setBusy(true);
    try {
      if (!/\.(xlsx|csv)$/i.test(file.name) || file.size > 5_000_000) throw new Error('Choose an .xlsx or .csv file smaller than 5 MB.');
      let rows;
      if (/\.csv$/i.test(file.name)) rows = csvRows(await file.text());else {
        const {
          readSheet
        } = await import('read-excel-file/browser');
        rows = await readSheet(file);
      }
      const parsed = spreadsheetLeads(rows);
      setEntries(parsed);
      const invalid = parsed.filter(entry => entry.error);
      if (invalid.length) showSnackbar({
        type: 'error',
        message: invalid.map(entry => `Row ${entry.row}: ${entry.error}`).join('\n')
      });
      setSelected(parsed.filter(entry => !entry.error).map(entry => entry.row));
      setMessage(`${parsed.length} contacts found. Review names carefully: titles were removed and names were split automatically.`);
    } catch (error) {
      showSnackbar({
        type: 'error',
        message: error.message || 'Unable to read this spreadsheet.'
      });
    } finally {
      setBusy(false);
    }
  }
  function edit(row, patch) {
    setEntries(current => current.map(entry => entry.row === row ? {
      ...entry,
      ...patch,
      error: ''
    } : entry));
    setReviewed(false);
    setResults([]);
  }
  async function submit(commit) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/leads/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          commit,
          entries: entries.filter(entry => selected.includes(entry.row))
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to import leads.');
      setResults(data.results);
      const failures = data.results.filter(result => result.status === 'error');
      if (failures.length) showSnackbar({
        type: 'error',
        message: failures.map(result => `Row ${result.row}: ${result.message}`).join('\n')
      });
      setReviewed(!commit);
      if (commit) {
        onImported(data.leads);
        const errors = data.results.filter(result => result.status === 'error');
        if (!errors.length) {
          onClose();
          return;
        }
        setSelected(errors.map(result => result.row));
        setMessage(`${data.leads.length} imported; ${data.results.filter(result => result.status === 'duplicate').length} duplicates skipped. Correct the selected rows and retry.`);
      } else setMessage('Duplicate check complete. Only rows marked Ready to import will be added.');
    } catch (error) {
      showSnackbar({
        type: 'error',
        message: error.message || 'Unable to import leads.'
      });
      setReviewed(false);
    } finally {
      setBusy(false);
    }
  }
  const ready = results.filter(result => result.status === 'ready').length;
  return <Dialog aria-labelledby="import-leads-title" aria-describedby="import-leads-description" open maxWidth="lg" onClose={() => {
    if (!busy) onClose();
  }}><DialogContent sx={{
      display: "grid",
      gap: 2
    }}>

      <header className={outreach.importHeader}>
        <div>
          <Typography id="import-leads-title" component="h2" variant="h6">Import leads</Typography>
          <Typography id="import-leads-description" component="p" variant="body2">Upload your spreadsheet, review the contacts, then check for duplicates before importing.</Typography>
        </div>
        <LeadIconButton type="button" aria-label="Close import" disabled={busy} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </LeadIconButton>
      </header>
      <section className={outreach.importUpload} aria-labelledby="import-file-label">
        <div className={outreach.importUploadHeading}>
          <FileSpreadsheet size={24} aria-hidden="true" />
          <div>
            <label id="import-file-label" htmlFor="import-leads-file">Excel or CSV spreadsheet</label>
            <Typography id="import-file-hint" component="p" variant="body2">.xlsx or .csv format · Maximum 5 MB</Typography>
          </div>
        </div>
        <div className={outreach.importFilePicker}>
          <LeadButton component="label" disabled={busy} startIcon={<Upload size={16} />}>
            {fileName ? "Change spreadsheet" : "Select spreadsheet"}
            <input id="import-leads-file" type="file" accept=".xlsx,.csv" hidden disabled={busy} onChange={event => {
              const file = event.target.files?.[0];
              setFileName(file?.name || "");
              void load(file);
              event.target.value = "";
            }} />
          </LeadButton>
          <span id="import-file-name" className={outreach.importFileName} title={fileName}>{fileName || 'No spreadsheet selected'}</span>
        </div>
        <Typography id="import-file-layout" className={outreach.importHint} component="p" variant="body2">Use the <strong>Leads.xlsx</strong> column layout: Firma, Ansprechpartner, Status, Datum, Tool, Nachverfolgung.</Typography>
        <div className={outreach.importTemplate}>
          <LeadButton href="/templates/leads-template.csv" download="leads-template.csv" component="a"><Download size={16} aria-hidden="true" />Download CSV template</LeadButton>
          <Typography className={outreach.importHint} component="p" variant="body2">Replace the example rows with your contacts and keep the column headers. Use YYYY-MM-DD for dates; a date is required when Status contains activity text. Save CSV files as UTF-8.</Typography>
        </div>
      </section>
      <Typography className={outreach.importHint} component="p" variant="body2">Existing contacts are skipped. Their details and activity stay intact.</Typography>
      {message && <Alert role="status" severity="info">{message}</Alert>}
      {entries.length > 0 && <div className={outreach.importRows}>
        {entries.map(entry => {
          const result = results.find(result => result.row === entry.row);
          return <LeadScope key={entry.row} disabled={busy}>
            <Typography variant="subtitle2">Row {entry.row} · {entry.contact.company || 'No company'}</Typography>
            <LeadCheckbox checked={selected.includes(entry.row)} disabled={result?.status === 'imported'} onChange={event => {
              setSelected(current => event.target.checked ? [...current, entry.row] : current.filter(row => row !== entry.row));
              setReviewed(false);
            }} label={<> Include contact</>}></LeadCheckbox>
            <div className={outreach.grid}>
              <LeadField value={entry.contact.firstName} onChange={event => edit(entry.row, {
                contact: {
                  ...entry.contact,
                  firstName: event.target.value
                }
              })} label={<>First name</>}></LeadField>
              <LeadField value={entry.contact.lastName} onChange={event => edit(entry.row, {
                contact: {
                  ...entry.contact,
                  lastName: event.target.value
                }
              })} label={<>Last name</>}></LeadField>
              <LeadField value={entry.activityText} onChange={event => edit(entry.row, {
                activityText: event.target.value
              })} label={<>Activity</>}></LeadField>
              <LeadField type="date" value={entry.occurredOn} onChange={event => edit(entry.row, {
                occurredOn: event.target.value
              })} label={<>Activity date</>}></LeadField>
              <LeadField type="date" value={entry.followUpOn} onChange={event => edit(entry.row, {
                followUpOn: event.target.value
              })} label={<>Follow-up date</>}></LeadField>
              <Typography component="p" variant="body2">Channel: {entry.channel || 'Other'}</Typography>
            </div>
            {result && result.status !== "error" && <Alert role="status" severity="info">{result.message}</Alert>}
          </LeadScope>;
        })}
      </div>}
      <footer className={outreach.importActions}>
        <LeadButton type="button" disabled={busy} onClick={onClose} variant="outlined">Close</LeadButton>
        <LeadButton type="button" disabled={busy || !selected.length || reviewed && !ready} onClick={() => void submit(reviewed)} variant="contained">
          {busy ? 'Processing…' : reviewed ? `Import ${ready} leads` : 'Check for duplicates'}
        </LeadButton>
      </footer>
    </DialogContent></Dialog>;
}
