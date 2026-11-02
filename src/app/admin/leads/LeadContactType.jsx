'use client';

import {Autocomplete, TextField, Alert, Stack} from '@mui/material';
import {useLeadDisabled} from './LeadUi';
import {normalizeLeadTypes} from '../../lib/leadTypes.mjs';

export default function LeadContactType({value = [], options = [], onChange, required = false, disabled = false}) {
  const inherited = useLeadDisabled();
  const values = normalizeLeadTypes(value);
  const choices = [...new Map([...options, ...values].map(item => [item.toLowerCase(), item])).values()];
  const selected = values.length > 1 ? '' : value.length === 1 ? value[0] : values[0] || '';
  function update(next) {
    const normalized = normalizeLeadTypes(next ? [next] : []);
    const canonical = choices.find(item => item.toLowerCase() === normalized[0]?.toLowerCase());
    onChange(canonical ? [canonical] : normalized);
  }
  return <Stack spacing={1}>
    {values.length > 1 && <Alert severity="warning">This lead has multiple contact types: {values.join(', ')}. Choose one to keep before saving or syncing.</Alert>}
    <Autocomplete freeSolo options={choices} value={selected || null} inputValue={selected} disabled={disabled || inherited}
      onInputChange={(_, text, reason) => {if (reason === 'input' || reason === 'clear') onChange(text ? [text] : []);}}
      onChange={(_, next) => update(next || '')}
      renderInput={params => <TextField {...params} label="Contact type" required={required} error={values.length > 1}
        helperText="Select or enter one contact type. Selecting another replaces the current value."
        slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, maxLength: 100}}} />} />
  </Stack>;
}
