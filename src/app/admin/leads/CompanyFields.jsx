"use client";

import {Alert} from '@mui/material';
import {useLeadRequirements} from './LeadRequirements';
import {useEffect, useState} from 'react';
import LeadTagsAutocomplete from './LeadTagsAutocomplete';
import CategoryTranslationDialog from './CategoryTranslationDialog';
import {formatCategoryLabel, normalizeCategories} from '../../lib/contactCategories.mjs';
const key = value => formatCategoryLabel(value).toLowerCase();
export default function CompanyFields({contact, onChange, disabled}) {
  const {requiredFields} = useLeadRequirements();
  const [catalog, setCatalog] = useState({products: [], applications: [], industries: []});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/admin/leads/category-translations', {cache: 'no-store', signal: abort.signal}).then(async response => {
      if (!response.ok) throw new Error('Saved translations could not be loaded. Reopen this lead to retry.');
      setCatalog(await response.json());
      setLoading(false);
    }).catch(failure => {if (failure.name !== 'AbortError') setError(failure.message);});
    return () => abort.abort();
  }, []);
  function rows(kind, source = catalog) {
    const values = kind === 'products' ? source.products : [...source.applications, ...source.industries];
    return [...new Map([...values].reverse().map(row => [key(row.label), row])).values()];
  }
  function update(kind, values, source = catalog) {
    const missing = values.find(label => !rows(kind, source).some(row => key(row.label) === key(label) && row.translations?.en && row.translations?.de));
    if (missing) {
      const saved = rows(kind, source).find(row => key(row.label) === key(missing));
      setEditor({kind: saved?.kind || kind, assignmentKind: kind, label: formatCategoryLabel(missing), translations: saved?.translations, pending: values});
    } else {onChange(kind, values); setEditor(null);}
  }
  return <>
    {['products', 'applications'].map(kind => <LeadTagsAutocomplete required={requiredFields.includes(kind)} key={kind} label={kind === 'products' ? 'Products' : 'Industry & applications'} value={normalizeCategories(contact[kind])} options={rows(kind).map(row => row.label)} allowCreate disabled={disabled || loading || Boolean(error)} onChange={values => update(kind, values)}
      formatValue={label => rows(kind).find(row => key(row.label) === key(label))?.translations?.[contact.language || 'en'] || label}
      onEdit={label => {
        const saved = rows(kind).find(row => key(row.label) === key(label));
        setEditor({kind: saved?.kind || kind, label, translations: saved?.translations});
      }}
      help="New values require English and German translations. Apollo uses the contact’s selected language." />)}
    {error && <Alert severity="error">{error}</Alert>}
    {editor && <CategoryTranslationDialog key={`${editor.kind}:${editor.label}`} entry={editor} onClose={() => setEditor(null)} onSaved={data => {
      setCatalog(data);
      if (editor.pending) update(editor.assignmentKind, editor.pending, data);
      else setEditor(null);
    }} />}
  </>;
}
