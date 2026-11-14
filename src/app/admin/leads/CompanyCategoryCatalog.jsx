'use client';
import {useState} from 'react';
import {Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography} from '@mui/material';
import {Pencil} from 'lucide-react';
import CategoryTranslationDialog from './CategoryTranslationDialog';
import {formatCategoryLabel} from '../../lib/contactCategories.mjs';

export default function CompanyCategoryCatalog() {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState({products: [], applications: [], industries: []});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kind, setKind] = useState('all');
  const [query, setQuery] = useState('');
  const [editor, setEditor] = useState(null);
  async function load() {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/admin/leads/category-translations', {cache: 'no-store'});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load products and industries.');
      setCatalog(data);
    } catch (failure) {setError(failure.message);}
    finally {setLoading(false);}
  }
  const industries = [...new Map([...catalog.industries, ...catalog.applications].map(row => [formatCategoryLabel(row.label).toLowerCase(), row])).values()];
  const entries = [...catalog.products.map(row => ({...row, kind: 'products'})), ...industries.map(row => ({...row, kind: row.kind || 'applications'}))];
  const rows = entries.filter(row => (kind === 'all' || (kind === 'products' ? row.kind === 'products' : row.kind !== 'products')) && [row.label, row.translations?.en, row.translations?.de].some(value => String(value || '').toLowerCase().includes(query.trim().toLowerCase())))
    .sort((a, b) => a.label.localeCompare(b.label));
  return <>
    <Button type="button" variant="outlined" onClick={() => {setOpen(true); void load();}}>Products & industries</Button>
    <Dialog open={open} fullWidth maxWidth="md" onClose={() => {if (!editor) setOpen(false);}} aria-labelledby="company-category-catalog-title">
      <DialogTitle id="company-category-catalog-title">Products & industries</DialogTitle>
      <DialogContent dividers><Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">Manage the shared product, industry and application names used by your leads. Apollo uses the name in each contact’s selected language.</Typography>
        <Stack direction={{xs: 'column', sm: 'row'}} spacing={2}>
          <TextField fullWidth label="Search names" value={query} onChange={event => setQuery(event.target.value)} />
          <TextField select label="Category" value={kind} onChange={event => setKind(event.target.value)} sx={{minWidth: 220}}>
            <MenuItem value="all">All categories</MenuItem><MenuItem value="products">Products</MenuItem><MenuItem value="applications">Industries & applications</MenuItem>
          </TextField>
        </Stack>
        {error && <Alert severity="error" action={<Button type="button" onClick={load}>Retry</Button>}>{error}</Alert>}
        {loading ? <Typography role="status">Loading catalog…</Typography> : !error && <>
          <Typography variant="body2" color="text.secondary">{catalog.products.length} products · {industries.length} industries & applications</Typography>
          <TableContainer><Table size="small" aria-label="Products and industries">
            <TableHead><TableRow><TableCell>Category</TableCell><TableCell>English</TableCell><TableCell>Deutsch</TableCell><TableCell align="right">Edit</TableCell></TableRow></TableHead>
            <TableBody>{rows.map(row => <TableRow key={`${row.kind}:${row.label}`}>
              <TableCell>{row.kind === 'products' ? 'Product' : 'Industry / application'}</TableCell>
              <TableCell>{row.translations?.en || row.label}</TableCell><TableCell>{row.translations?.de || 'Missing'}</TableCell>
              <TableCell align="right"><IconButton type="button" size="small" aria-label={`Edit ${row.label}`} title={`Edit ${row.label}`} onClick={() => setEditor(row)}><Pencil size={16} /></IconButton></TableCell>
            </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={4}>No matching products or industries.</TableCell></TableRow>}</TableBody>
          </Table></TableContainer>
        </>}
      </Stack></DialogContent>
      <DialogActions><Button type="button" onClick={() => setOpen(false)}>Done</Button></DialogActions>
    </Dialog>
    {editor && <CategoryTranslationDialog key={`${editor.kind}:${editor.label}`} entry={editor} onClose={() => setEditor(null)} onSaved={data => {setCatalog(data); setEditor(null);}} />}
  </>;
}
