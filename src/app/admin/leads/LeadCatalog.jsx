'use client';
import {useState} from 'react';
import {Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography} from '@mui/material';

export default function LeadCatalog({onChange}) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('type');
  const [label, setLabel] = useState('');
  const [catalog, setCatalog] = useState({leadTypes: [], sources: []});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function request(add = false) {
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/leads/catalog', add ? {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({kind, label})} : {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load choices.');
      setCatalog(data); onChange?.(data);
      if (add) {setLabel(''); setMessage('Saved. This choice is available on leads and in default sequence rules.');}
    } catch (failure) {setError(failure.message);}
    finally {setBusy(false);}
  }
  return <>
    <Button type="button" variant="outlined" onClick={() => {setOpen(true); void request();}}>Contact types & sources</Button>
    <Dialog open={open} onClose={() => {if (!busy) setOpen(false);}} fullWidth maxWidth="sm">
      <DialogTitle>Contact types & sources</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Typography variant="body2">Add reusable choices here, then assign their default sequences in Integrations → Apollo. Adding a choice does not change existing leads or enroll contacts.</Typography>
        <TextField select label="Category" value={kind} disabled={busy} onChange={event => {setKind(event.target.value); setLabel(''); setMessage('');}}>
          <MenuItem value="type">Contact type</MenuItem><MenuItem value="source">Source</MenuItem>
        </TextField>
        <TextField label={kind === 'type' ? 'Contact type name' : 'Source name'} value={label} disabled={busy} slotProps={{htmlInput: {maxLength: kind === 'type' ? 100 : 200}}} onChange={event => setLabel(event.target.value)} onKeyDown={event => {if (event.key === 'Enter') {event.preventDefault(); event.stopPropagation(); if (label.trim() && !busy) void request(true);}}} />
        <Button type="button" variant="contained" disabled={busy || !label.trim()} onClick={() => request(true)}>{busy ? 'Loading…' : 'Add choice'}</Button>
        {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
        <Stack direction="row" sx={{flexWrap: 'wrap', gap: 1}}>{(kind === 'type' ? catalog.leadTypes : catalog.sources).map(value => <Chip key={value} label={value} />)}</Stack>
      </Stack></DialogContent>
      <DialogActions><Button type="button" disabled={busy} onClick={() => setOpen(false)}>Done</Button></DialogActions>
    </Dialog>
  </>;
}
