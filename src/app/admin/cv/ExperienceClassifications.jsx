'use client';
import {useEffect, useState} from 'react';
import {Alert, Button, Stack} from '@mui/material';
import TaxonomyAutocomplete from '../components/forms/TaxonomyAutocomplete';
export default function ExperienceClassifications({value = {}, onChange, disabled, onBusyChange}) {
  const [catalog, setCatalog] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const refresh = () => setAttempt(value => value + 1);
    window.addEventListener('experience-industries-changed', refresh);
    return () => window.removeEventListener('experience-industries-changed', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/experience-catalog', {cache: 'no-store', signal: controller.signal}).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load classifications.');
      setCatalog(data); setError('');
    }).catch(failure => {if (!controller.signal.aborted) setError(failure.message);});
    return () => controller.abort();
  }, [attempt]);
  async function createClassification(taxonomy, label) {
    const response = await fetch('/api/admin/experience-catalog', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({taxonomy, label})});
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save classification.');
    setCatalog(current => ({...current, [taxonomy]: [...current[taxonomy].filter(item => item.id !== data.id), data]}));
    if (taxonomy === 'industries') window.dispatchEvent(new Event('experience-industries-changed'));
    return data;
  }
  return <Stack spacing={2}>
    {error && <Alert severity="error" action={<Button onClick={() => setAttempt(n => n + 1)}>Retry</Button>}>{error}</Alert>}
    {Object.entries({industries: 'Industries & applications', competencies: 'Functional expertise', countries: 'Countries / markets'}).map(([field, label]) => <TaxonomyAutocomplete
      key={field} label={label} ids={value[field] || []} options={catalog?.[field] || []} loading={!catalog} disabled={disabled}
      onChange={ids => onChange({...value, [field]: ids})} onCreate={field !== 'countries' ? label => createClassification(field, label) : undefined} onBusyChange={onBusyChange}
      helperText={field === 'countries' ? 'Select countries where this role involved operating a business, serving customers, or developing distribution partners. A regional label or office address alone is not enough.' : field === 'competencies' ? 'Select a shared skill or type a new expertise and choose Add. New entries are also available in Skills administration.' : 'Use sectors or applications evidenced in this role, such as industrial automation, warehouse automation, or automotive. Reuse existing labels; avoid adding synonyms just for search keywords.'} />)}
  </Stack>;
}
