'use client';

import {createContext, useContext, useState} from 'react';
import {Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableHead, TableBody, TableRow, TableCell, Typography} from '@mui/material';
import {DEFAULT_REQUIRED_LEAD_FIELDS, DEFAULT_APOLLO_REQUIRED_FIELDS, LEAD_REQUIREMENT_FIELDS} from '../../lib/leadRequirements.mjs';

const Context = createContext({requiredFields: DEFAULT_REQUIRED_LEAD_FIELDS, apolloRequiredFields: DEFAULT_APOLLO_REQUIRED_FIELDS});
export const useLeadRequirements = () => useContext(Context);
export default function LeadRequirementsProvider({initialSettings, children}) {
  const [settings, setSettings] = useState(initialSettings);
  return <Context.Provider value={{...settings, setSettings}}>{children}</Context.Provider>;
}
export function LeadRequirementsSettings() {
  const {requiredFields, apolloRequiredFields = DEFAULT_APOLLO_REQUIRED_FIELDS, setSettings} = useLeadRequirements();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(requiredFields);
  const [apolloDraft, setApolloDraft] = useState(apolloRequiredFields);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save() {
    setSaving(true); setError('');
    try {
      const response = await fetch('/api/admin/leads/settings', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({requiredFields: draft, apolloRequiredFields: apolloDraft})});
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save required fields.');
      setSettings(result); setOpen(false);
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }
  return <>
    <Button variant="outlined" onClick={() => {setDraft([...requiredFields]); setApolloDraft([...apolloRequiredFields]); setError(''); setOpen(true);}}>Required fields</Button>
    <Dialog open={open} onClose={() => {if (!saving) setOpen(false);}} fullWidth maxWidth="sm">
      <DialogTitle>Required lead fields</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" sx={{mb: 2}}>Choose requirements separately for saving/importing leads and for Apollo sync. Apollo checks both columns. A contact name is always required. Email is optional locally by default; email sequence enrollment still requires an email.</Typography>
        <Alert severity="info" sx={{mb: 2}}>Select every field used by your sequence variables. These rules do not stop sequences already running in Apollo or enrollment performed directly in Apollo.</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        <Table size="small" aria-label="Required fields by destination">
          <TableHead><TableRow><TableCell>Field</TableCell><TableCell align="center">Save lead</TableCell><TableCell align="center">Apollo sync</TableCell></TableRow></TableHead>
          <TableBody>{Object.entries(LEAD_REQUIREMENT_FIELDS).map(([key, label]) => <TableRow key={key}>
            <TableCell component="th" scope="row">{label}</TableCell>
            <TableCell align="center"><Checkbox disabled={saving} slotProps={{input: {'aria-label': `${label}: required to save lead`}}} checked={draft.includes(key)} onChange={event => setDraft(current => event.target.checked ? [...current, key] : current.filter(value => value !== key))} /></TableCell>
            <TableCell align="center"><Checkbox disabled={saving} slotProps={{input: {'aria-label': `${label}: required for Apollo sync`}}} checked={apolloDraft.includes(key)} onChange={event => setApolloDraft(current => event.target.checked ? [...current, key] : current.filter(value => value !== key))} /></TableCell>
          </TableRow>)}</TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{flexWrap: 'wrap'}}>
        <Button disabled={saving} onClick={() => {setDraft([...DEFAULT_REQUIRED_LEAD_FIELDS]); setApolloDraft([...DEFAULT_APOLLO_REQUIRED_FIELDS]);}}>Restore defaults</Button>
        <Button disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={saving} variant="contained" onClick={save}>{saving ? 'Saving…' : 'Save settings'}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
