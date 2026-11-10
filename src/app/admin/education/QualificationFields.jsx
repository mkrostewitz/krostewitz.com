'use client';
import {Button, Checkbox, FormControlLabel, MenuItem, Paper, Stack, TextField, Typography} from '@mui/material';
import {EDUCATION_TYPES} from '../../lib/educationData.mjs';

export default function QualificationFields({entries, disabled, onChange}) {
  const update = (id, change) => onChange(entries.map(entry => entry.id === id ? change(entry) : entry));
  function move(index, offset) {
    const next = [...entries];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    onChange(next);
  }
  return <Stack spacing={2}>
    <Typography component="h3" variant="h6">Qualifications</Typography>
    <Typography color="text.secondary">Add degrees, vocational training, professional certificates, courses, or licenses. Entries stay private until you select Show on website and save. Missing translations use the available language.</Typography>
    {entries.map((entry, index) => <Paper key={entry.id} variant="outlined" sx={{p: 2}}><Stack spacing={2}>
      <Stack direction={{xs: 'column', sm: 'row'}} spacing={2}>
        <TextField fullWidth select label="Qualification type" value={entry.type} disabled={disabled} onChange={event => update(entry.id, row => ({...row, type: event.target.value}))}>
          {Object.entries(EDUCATION_TYPES).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
        </TextField>
        <TextField label="Completion year (optional)" value={entry.year} disabled={disabled} slotProps={{htmlInput: {maxLength: 4, inputMode: 'numeric', pattern: '[1-9][0-9]{3}'}}} onChange={event => update(entry.id, row => ({...row, year: event.target.value}))} />
      </Stack>
      {['en', 'de'].map(language => <Stack key={language} spacing={2}>
        <Typography variant="subtitle2">{language === 'en' ? 'English' : 'German'}</Typography>
        {['title', 'institution', 'detail'].map(field => <TextField key={field} label={{title: 'Qualification title', institution: 'Institution / awarding organization', detail: 'Description (optional)'}[field]} multiline={field === 'detail'} minRows={field === 'detail' ? 2 : undefined} value={entry.translations[language][field]} disabled={disabled} slotProps={{htmlInput: {maxLength: field === 'detail' ? 2000 : 240}}} onChange={event => update(entry.id, row => ({...row, translations: {...row.translations, [language]: {...row.translations[language], [field]: event.target.value}}}))} />)}
      </Stack>)}
      <TextField label="Credential / verification link (optional)" type="url" value={entry.url} disabled={disabled} slotProps={{htmlInput: {maxLength: 2000}}} onChange={event => update(entry.id, row => ({...row, url: event.target.value}))} />
      <FormControlLabel label="Show on website" control={<Checkbox checked={entry.published} disabled={disabled} onChange={event => update(entry.id, row => ({...row, published: event.target.checked}))} />} />
      <Stack direction="row" spacing={1}>
        <Button disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label="Move qualification up">Move up</Button>
        <Button disabled={disabled || index === entries.length - 1} onClick={() => move(index, 1)} aria-label="Move qualification down">Move down</Button>
        <Button disabled={disabled} onClick={() => {if (window.confirm('Remove this qualification? Save education to apply the removal.')) onChange(entries.filter(row => row.id !== entry.id));}}>Remove</Button>
      </Stack>
    </Stack></Paper>)}
    {!entries.length && <Typography>No qualifications added. This section stays hidden on the website until you publish an entry.</Typography>}
    <Button disabled={disabled || entries.length >= 100} onClick={() => onChange([...entries, {id: crypto.randomUUID(), type: 'certificate', published: false, year: '', url: '', translations: {en: {title: '', institution: '', detail: ''}, de: {title: '', institution: '', detail: ''}}}])}>Add qualification</Button>
  </Stack>;
}
