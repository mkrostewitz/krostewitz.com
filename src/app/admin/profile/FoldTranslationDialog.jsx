"use client";

import {useEffect, useRef, useState} from 'react';
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Typography} from '@mui/material';
import {validateFoldCopy} from '../../lib/foldContent.mjs';
import FoldFields from './FoldFields';

export default function FoldTranslationDialog({source, sourceLanguage, onApply, onClose}) {
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
      const translation = validateFoldCopy(source);
      const response = await fetch('/api/admin/fold/translate', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, signal: controller.current.signal,
        body: JSON.stringify({sourceLanguage, targetLanguage, translation}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to translate Fold / Hero.');
      setDraft(validateFoldCopy(data.translation, translation));
    } catch (error) {
      if (error.name !== 'AbortError') setError(error.message);
    } finally {setBusy(false);}
  }

  function apply() {
    try {onApply(targetLanguage, validateFoldCopy(draft));}
    catch (error) {setError(error.message);}
  }

  return <Dialog open fullWidth maxWidth="md" onClose={onClose} aria-labelledby="fold-translation-title"
    sx={theme => ({colorScheme: theme.palette.mode})}>
    <DialogTitle id="fold-translation-title">Translate Fold / Hero: {names[sourceLanguage]} → {names[targetLanguage]}</DialogTitle>
    {busy && <LinearProgress aria-label="Translating Fold / Hero" />}
    <DialogContent dividers aria-busy={busy}>
      <Stack spacing={2}>
        <Typography>Translate the current headline segments, subheadline, personal statement, cards, and button labels. Review and edit the result before applying it.</Typography>
        <Alert severity="info">Applying replaces the {names[targetLanguage]} text in the editor. Publish it with Save Fold / Hero.</Alert>
        {error && <Alert severity="error">{error}</Alert>}
        {draft && <FoldFields copy={draft} language={targetLanguage} onChange={setDraft} disabled={busy} />}
      </Stack>
    </DialogContent>
    <DialogActions sx={{p: 2, flexWrap: 'wrap', gap: 1}}>
      <Button type="button" onClick={onClose}>Cancel</Button>
      {!draft && <Button type="button" variant="contained" disabled={busy} onClick={translate}>{busy ? 'Translating…' : 'Translate'}</Button>}
      {draft && <Button type="button" variant="contained" disabled={busy} onClick={apply}>Apply translation</Button>}
    </DialogActions>
  </Dialog>;
}
