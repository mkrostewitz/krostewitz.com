'use client';
import {useEffect, useState} from 'react';
import {Alert, Button, Paper, Stack, TextField, Typography} from '@mui/material';
import {normalizeEducationEntries, normalizeEducationLanguages} from '../../lib/educationData.mjs';
import styles from '../admin.module.css';
import QualificationFields from './QualificationFields';
export default function EducationEditor() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/education', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load education.');
      setData({...body, entries: body.entries || []}); setError('');
    }).catch(failure => {if (!controller.signal.aborted) setError(failure.message);});
    return () => controller.abort();
  }, [attempt]);
  function update(index, change) {
    setMessage('');
    setData(current => ({...current, languages: current.languages.map((item, i) => i === index ? change(item) : item)}));
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const languages = normalizeEducationLanguages(data.languages);
      const entries = normalizeEducationEntries(data.entries);
      const response = await fetch('/api/admin/education', {method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...data, languages, entries})});
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to save education.');
      setData(body); setMessage('Education saved.');
    } catch (failure) {setError(failure.message);} finally {setBusy(false);}
  }
  return <section className={styles.profilePanel}>
    <div className={styles.panelHeader}><div className={styles.titleBlock}><h2>Qualifications & languages</h2><p className={styles.muted}>Choose which qualifications to display. Every category is optional, including school qualifications.</p></div></div>
    <Stack component="form" spacing={2} onSubmit={save}>
      {error && <Alert severity="error" action={<Button disabled={busy} onClick={() => {if (!data || window.confirm('Reload education and discard unsaved changes?')) setAttempt(n => n + 1);}}>Reload</Button>}>{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}
      {!data ? <p>Loading education…</p> : <>
        <QualificationFields entries={data.entries || []} disabled={busy} onChange={entries => {setData(current => ({...current, entries})); setMessage('');}} />
        <Typography component="h3" variant="h6">Languages</Typography>
        <Typography color="text.secondary">Language proficiency appears in At a glance.</Typography>
        {data.languages.map((item, index) => <Paper key={index} variant="outlined" sx={{p: 2}}><Stack spacing={2}>
          <TextField label="Language code" error={item.code.trim().toLowerCase() === 'cn'} helperText={item.code.trim().toLowerCase() === 'cn' ? 'Use zh for Chinese. CN is the country code for China and cannot be saved as a language code.' : 'Language code: en = English, de = German, zh = Chinese. This code appears on the homepage badge.'} required value={item.code} disabled={busy} onChange={event => update(index, row => ({...row, code: event.target.value}))} slotProps={{htmlInput: {maxLength: 3}}} />
          {['en', 'de'].map(language => <Stack key={language} spacing={1}>
            <Typography variant="subtitle2">{language === 'en' ? 'English' : 'German'} display</Typography>
            <Stack direction={{xs: 'column', sm: 'row'}} spacing={2}>
              {['name', 'level'].map(field => <TextField key={field} fullWidth required disabled={busy} label={field === 'name' ? 'Language name' : 'Proficiency'} value={item.translations[language][field]} slotProps={{htmlInput: {maxLength: 100}}} onChange={event => update(index, row => ({...row, translations: {...row.translations, [language]: {...row.translations[language], [field]: event.target.value}}}))} />)}
            </Stack>
          </Stack>)}
          <Button disabled={busy} onClick={() => {setData(current => ({...current, languages: current.languages.filter((_, i) => i !== index)})); setMessage('');}}>Remove language</Button>
        </Stack></Paper>)}
        {!data.languages.length && <Typography>No languages configured.</Typography>}
        <Stack direction="row" spacing={2}>
          <Button disabled={busy || data.languages.length >= 30} onClick={() => {setData(current => ({...current, languages: [...current.languages, {code: '', translations: {en: {name: '', level: ''}, de: {name: '', level: ''}}}]})); setMessage('');}}>Add language</Button>
          <Button variant="contained" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save education'}</Button>
        </Stack>
      </>}
    </Stack>
  </section>;
}
