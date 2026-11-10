"use client";

import {useEffect, useRef, useState} from 'react';
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography} from '@mui/material';
import {validateAboutTranslation} from '../../lib/aboutTranslation.mjs';

export default function AboutTranslationDialog({source, sourceLanguage, onApply, onClose}) {
  const targetLanguage = sourceLanguage === 'en' ? 'de' : 'en';
  const names = {en: 'English', de: 'German'};
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function translate() {
    setError('');
    setBusy(true);
    controller.current = new AbortController();
    try {
      const translation = validateAboutTranslation({...source, highlights: source.highlights.filter(item => item.trim())});
      const response = await fetch('/api/admin/about/translate', {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        signal: controller.current.signal,
        body: JSON.stringify({sourceLanguage, targetLanguage, translation}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to translate About.');
      setDraft(validateAboutTranslation(data.translation, translation));
    } catch (error) {
      if (error.name !== 'AbortError') setError(error.message);
    } finally {setBusy(false);}
  }

  function apply() {
    try {
      const translation = validateAboutTranslation({...draft, highlights: draft.highlights.filter(item => item.trim())});
      onApply(targetLanguage, translation);
    } catch (error) {setError(error.message);}
  }

  return <Dialog open fullWidth maxWidth="md" onClose={onClose} aria-labelledby="about-translation-title"
    sx={theme => ({colorScheme: theme.palette.mode})}>
    <DialogTitle id="about-translation-title">Translate About: {names[sourceLanguage]} → {names[targetLanguage]}</DialogTitle>
    {busy && <LinearProgress aria-label="Translating About" />}
    <DialogContent dividers aria-busy={busy}>
      <Stack spacing={2}>
        <Typography>Translate the current headline, introduction, and career highlights. Review and edit the result before applying it.</Typography>
        <Alert severity="info">Applying replaces the {names[targetLanguage]} text in the editor. Publish it with Save About.</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {draft ? <>
          <TextField label="Translated headline" multiline minRows={2} disabled={busy} value={draft.headline}
            slotProps={{htmlInput: {maxLength: 500, lang: targetLanguage}}}
            onChange={event => setDraft(current => ({...current, headline: event.target.value}))} />
          <TextField label="Translated About text" multiline minRows={8} disabled={busy}
            value={draft.body.replace(/<br\s*\/?\s*>/gi, '\n')}
            slotProps={{htmlInput: {maxLength: 20000, lang: targetLanguage}}}
            onChange={event => setDraft(current => ({...current, body: event.target.value.replace(/\n/g, '<br/>')}))} />
          <TextField label="Translated career highlights" multiline minRows={5} disabled={busy} value={draft.highlights.join('\n')}
            helperText="One highlight per line." slotProps={{htmlInput: {lang: targetLanguage}}}
            onChange={event => setDraft(current => ({...current, highlights: event.target.value.split('\n')}))} />
        </> : <Typography color="text.secondary">Your {names[sourceLanguage]} text and portrait will stay unchanged.</Typography>}
      </Stack>
    </DialogContent>
    <DialogActions sx={{p: 2, flexWrap: 'wrap', gap: 1}}>
      <Button type="button" onClick={onClose}>Cancel</Button>
      {!draft && <Button type="button" variant="contained" disabled={busy} onClick={translate}>{busy ? 'Translating…' : 'Translate'}</Button>}
      {draft && <Button type="button" variant="contained" disabled={busy} onClick={apply}>Apply translation</Button>}
    </DialogActions>
  </Dialog>;
}
