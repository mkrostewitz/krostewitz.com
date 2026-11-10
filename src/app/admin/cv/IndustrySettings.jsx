'use client';

import {useEffect, useState} from 'react';
import {Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, MenuItem, Stack, TextField, Typography} from '@mui/material';
import {Search} from 'lucide-react';
import styles from '../admin.module.css';

import IndustryIcon from '../../components/IndustryIcon';
import {INDUSTRY_ICON_OPTIONS} from '../../lib/industryIcons.mjs';

const ICONS = {'': 'Automatic', ...INDUSTRY_ICON_OPTIONS};
const notifyChange = () => window.dispatchEvent(new Event('experience-industries-changed'));
export default function IndustrySettings() {
  const [industries, setIndustries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [label, setLabel] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener('experience-industries-changed', refresh);
    return () => window.removeEventListener('experience-industries-changed', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/industries', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load industries.');
      setIndustries(data.industries); setError('');
    }).catch(failure => {if (!controller.signal.aborted) setError(failure.message);})
      .finally(() => {if (!controller.signal.aborted) setLoading(false);});
    return () => controller.abort();
  }, [attempt]);
  function open(item) {
    setEditing({...item, translations: Object.fromEntries(['en', 'de'].map(language => [language, {
      label: item.translations?.[language]?.label || (language === 'en' ? item.label : ''),
      detail: item.translations?.[language]?.detail || '',
    }]))});
    setEditError('');
  }
  async function save(event, edit) {
    event.preventDefault(); setBusy(true);
    if (edit) setEditError(''); else setError('');
    try {
      const response = await fetch('/api/admin/industries', {method: edit ? 'PATCH' : 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(edit ? editing : {label})});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save industry.');
      if (edit) setEditing(null);
      else {setLabel(''); open(data.industry);}
      notifyChange();
    } catch (failure) {if (edit) setEditError(failure.message); else setError(failure.message);}
    finally {setBusy(false);}
  }
  function change(language, field, value) {
    setEditing(current => ({...current, translations: {...current.translations, [language]: {...current.translations[language], [field]: value}}}));
  }
  const query = search.trim().toLocaleLowerCase();
  async function remove() {
    setBusy(true);
    setDeleteError('');
    try {
      const response = await fetch('/api/admin/industries', {
        method: 'DELETE', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({id: deleting.id, revision: deleting.revision}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to delete industry.');
      setIndustries(current => current.filter(item => item.id !== deleting.id));
      setDeleting(null);
      notifyChange();
    } catch (failure) {setDeleteError(failure.message);}
    finally {setBusy(false);}
  }
  const visibleIndustries = industries
    .filter(item => [item.label, ...Object.values(item.translations || {}).flatMap(translation => [translation.label, translation.detail])]
      .some(value => value?.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.label.localeCompare(b.label, 'en', {sensitivity: 'base', numeric: true}));

  return <section className={styles.portfolioPanel} aria-busy={loading || busy}>
    <Stack spacing={3}>
      <Box>
        <Typography variant="h5" component="h2" sx={{mb: 1}}>Industry Focus</Typography>
        <Typography variant="body2" color="text.secondary">Manage the industries available for your Experience roles. Assign an industry to a role to show it on your website.</Typography>
      </Box>
      {error && <Alert severity="error" action={<Button onClick={() => setAttempt(value => value + 1)}>Retry</Button>}>{error}</Alert>}
      <Stack component="form" onSubmit={event => save(event, false)} direction={{xs: 'column', sm: 'row'}} spacing={1.5} sx={{p: 2, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover'}}>
        <TextField size="small" label="New industry" value={label} disabled={busy || loading} onChange={event => setLabel(event.target.value)} slotProps={{htmlInput: {maxLength: 100}}} fullWidth />
        <Button variant="contained" type="submit" disabled={busy || loading || !label.trim()} sx={{flexShrink: 0}}>Add industry</Button>
      </Stack>
      <Box>
        <Stack direction={{xs: 'column', sm: 'row'}} spacing={2} alignItems={{sm: 'center'}} justifyContent="space-between" sx={{mb: 2}}>
          <Box sx={{flexShrink: 0}}>
            <Typography component="h3" variant="subtitle1" fontWeight={600}>Industry library</Typography>
            <Typography variant="body2" color="text.secondary" role="status">
              {loading ? 'Loading industries…' : `${visibleIndustries.length} of ${industries.length} industries · A–Z`}
            </Typography>
          </Box>
          <TextField
            size="small" label="Search industries" type="search" value={search}
            onChange={event => setSearch(event.target.value)}
            helperText="Search English and German titles or descriptions"
            sx={{width: {xs: '100%', sm: 360}, maxWidth: '100%'}}
            slotProps={{input: {startAdornment: <InputAdornment position="start"><Search size={18} aria-hidden="true" /></InputAdornment>}}}
          />
        </Stack>
        {visibleIndustries.length > 0 && <Box component="ul" sx={{listStyle: 'none', m: 0, p: 0, border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden'}}>
          {visibleIndustries.map(item => <Box component="li" key={item.id} sx={{
            display: 'grid', gridTemplateColumns: {xs: '36px minmax(0, 1fr)', sm: '40px minmax(0, 1fr) auto'},
            gap: 1.5, alignItems: 'start', p: 2,
            '& + li': {borderTop: 1, borderColor: 'divider'},
            '&:hover, &:focus-within': {bgcolor: 'action.hover'},
          }}>
            <Box aria-hidden="true" sx={{display: 'grid', placeItems: 'center', width: {xs: 36, sm: 40}, height: {xs: 36, sm: 40}, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.secondary'}}>
              <IndustryIcon industry={item} size={20} />
            </Box>
            <Box sx={{minWidth: 0}}>
              <Typography component="h4" variant="body1" fontWeight={600} sx={{overflowWrap: 'anywhere'}}>{item.label}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{overflowWrap: 'anywhere'}}>DE: {item.translations?.de?.label || 'German title missing'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{mt: 0.5, overflowWrap: 'anywhere', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'}}>
                {item.translations?.en?.detail || 'No English description yet.'}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} sx={{gridColumn: {xs: 2, sm: 'auto'}, justifySelf: 'start', alignSelf: 'center'}}>
              <Button variant="outlined" size="small" disabled={busy} onClick={() => open(item)} aria-label={`Edit ${item.label}`}>Edit</Button>
              <Button color="error" size="small" disabled={busy} onClick={() => {setDeleting(item); setDeleteError('');}} aria-label={`Delete ${item.label}`}>Delete</Button>
            </Stack>
          </Box>)}
        </Box>}
        {!loading && !error && visibleIndustries.length === 0 && <Box sx={{p: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 2}}>
          <Typography color="text.secondary">{query ? 'No industries match your search.' : 'Add your first industry above, then assign it to an Experience role.'}</Typography>
          {query && <Button onClick={() => setSearch('')} sx={{mt: 1}}>Clear search</Button>}
        </Box>}
      </Box>
    </Stack>
    <Dialog open={Boolean(deleting)} onClose={() => {if (!busy) setDeleting(null);}} fullWidth maxWidth="xs" aria-labelledby="delete-industry-title" aria-describedby="delete-industry-description">
      <DialogTitle id="delete-industry-title">Delete industry?</DialogTitle>
      <DialogContent>
        <Typography id="delete-industry-description">Delete “{deleting?.label}” from the industry library? This cannot be undone. Industries assigned to Experience roles cannot be deleted.</Typography>
        {deleteError && <Alert severity="error" sx={{mt: 2}}>{deleteError}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={() => setDeleting(null)}>Cancel</Button>
        <Button color="error" variant="contained" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete industry'}</Button>
      </DialogActions>
    </Dialog>
    <Dialog open={Boolean(editing)} onClose={() => {if (!busy) setEditing(null);}} fullWidth maxWidth="sm">
      <form onSubmit={event => save(event, true)}>
        <DialogTitle>Edit industry</DialogTitle>
        <DialogContent><Stack spacing={2} sx={{pt: 1}}>
          {editError && <Alert severity="error">{editError}</Alert>}
          {['en', 'de'].map(language => <Stack spacing={2} key={language}>
            <TextField label={`${language === 'en' ? 'English' : 'German'} title`} required={language === 'en'} value={editing?.translations[language].label || ''} onChange={event => change(language, 'label', event.target.value)} disabled={busy} slotProps={{htmlInput: {maxLength: 100}}} />
            <TextField label={`${language === 'en' ? 'English' : 'German'} description (optional)`} multiline minRows={2} value={editing?.translations[language].detail || ''} onChange={event => change(language, 'detail', event.target.value)} disabled={busy} slotProps={{htmlInput: {maxLength: 4000}}} />
          </Stack>)}
          <TextField select label="Icon" helperText="Automatic matches the industry title. Choose an icon to override it." value={editing?.icon || ''} disabled={busy} onChange={event => setEditing(current => ({...current, icon: event.target.value}))}>
            {Object.entries(ICONS).map(([value, title]) => <MenuItem key={value} value={value}><Stack direction="row" alignItems="center" spacing={1.5}><IndustryIcon industry={{...editing, icon: value}} /><span>{title}</span></Stack></MenuItem>)}
          </TextField>
        </Stack></DialogContent>
        <DialogActions><Button disabled={busy} onClick={() => setEditing(null)}>Close</Button><Button type="submit" disabled={busy}>Save industry</Button></DialogActions>
      </form>
    </Dialog>
  </section>;
}
