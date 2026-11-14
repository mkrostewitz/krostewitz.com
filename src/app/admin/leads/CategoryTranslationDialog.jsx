'use client';
import {useState} from 'react';
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography} from '@mui/material';

export default function CategoryTranslationDialog({entry, onClose, onSaved}) {
  const [translations, setTranslations] = useState({en: entry.translations?.en || entry.label, de: entry.translations?.de || ''});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function request(ai) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/leads/category-translations', {method: ai ? 'POST' : 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...entry, translations})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save translations.');
      if (ai) setTranslations(data.translations);
      else onSaved(data);
    } catch (failure) {setError(failure.message);}
    finally {setBusy(false);}
  }
  return <Dialog open fullWidth maxWidth="sm" onClose={() => {if (!busy) onClose();}}>
    <DialogTitle>{entry.kind === 'products' ? 'Edit product' : 'Edit industry / application'}</DialogTitle>
    <DialogContent dividers><Stack spacing={2}>
      <Typography>“{entry.label}” is a shared catalog entry. Changes to its English and German names apply to all leads.</Typography>
      {['en', 'de'].map(language => <TextField key={language} required label={language === 'en' ? 'English' : 'Deutsch'} value={translations[language]} disabled={busy} slotProps={{htmlInput: {maxLength: 100}}} onChange={event => setTranslations(current => ({...current, [language]: event.target.value}))} />)}
      <Button type="button" disabled={busy} onClick={() => request(true)}>Translate with AI</Button>
      <Typography variant="body2" color="text.secondary">Review AI suggestions before saving. Existing Apollo contacts receive changes on their next sync.</Typography>
      {error && <Alert severity="error">{error}</Alert>}
    </Stack></DialogContent>
    <DialogActions><Button type="button" disabled={busy} onClick={onClose}>Cancel</Button><Button type="button" variant="contained" disabled={busy || !translations.en.trim() || !translations.de.trim()} onClick={() => request(false)}>{busy ? 'Working…' : 'Save changes'}</Button></DialogActions>
  </Dialog>;
}
