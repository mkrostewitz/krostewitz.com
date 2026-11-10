'use client';
import {useState} from 'react';
import {Alert, Autocomplete, CircularProgress, Stack, TextField} from '@mui/material';
import {isTaxonomyOption, taxonomyOptionLabel, taxonomyOptionsEqual} from '../../../lib/taxonomyOptions.mjs';
import {createFilterOptions} from '@mui/material/Autocomplete';
import {classificationKey} from '../../../lib/experienceClassifications.mjs';

const filterOptions = createFilterOptions();

// Object options keep persisted identifiers separate from editable display labels.
export default function TaxonomyAutocomplete({label, ids = [], options = [], onChange, onCreate, disabled, loading, helperText, onBusyChange}) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const choices = options.filter(isTaxonomyOption);
  const value = ids.map(id => choices.find(option => option.id === id) || {id, label: `${id} (unavailable)`});
  async function change(values) {
    setError('');
    setCreating(true); onBusyChange?.(true);
    try {
      const resolved = [];
      for (const item of values) {
        let option = item;
        if (item?.inputValue) option = item.inputValue;
        if (typeof option === 'string') {
          const input = option;
          option = choices.find(choice => classificationKey(choice.label) === classificationKey(input));
          if (!option && onCreate) option = await onCreate(input);
        }
        if (!isTaxonomyOption(option)) throw new Error(`Choose a valid suggestion or retry adding ${label.toLowerCase()}.`);
        if (!resolved.some(existing => existing.id === option.id)) resolved.push(option);
      }
      onChange(resolved.map(item => item.id));
    } catch (failure) { setError(failure.message); }
    finally { setCreating(false); onBusyChange?.(false); }
  }
  return <Stack spacing={1}>
    <Autocomplete multiple openOnFocus autoHighlight freeSolo={Boolean(onCreate)} filterSelectedOptions disableCloseOnSelect
      disabled={disabled || creating || loading} loading={loading || creating} options={choices} value={value}
      onKeyDown={event => {
        // Enter belongs to the combobox even when no suggestion is selected.
        // preventDefault blocks native form submission while MUI still handles
        // selection / freeSolo creation (do not set defaultMuiPrevented).
        if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
      }}
      filterOptions={(options, params) => {
        const filtered = filterOptions(options, params);
        const input = params.inputValue.trim();
        if (onCreate && input && !choices.some(option => classificationKey(option.label) === classificationKey(input))) {
          filtered.push({inputValue: input, label: `Add “${input}”`});
        }
        return filtered;
      }}
      getOptionLabel={option => option?.inputValue ? option.label : taxonomyOptionLabel(option)}
      isOptionEqualToValue={taxonomyOptionsEqual} onChange={(_, values) => void change(values)}
      renderInput={params => <TextField {...params} label={label} helperText={helperText} slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, maxLength: 100}}} />} />
    {creating && <CircularProgress size={18} aria-label="Saving shared value" />}
    {error && <Alert severity="error">{error}</Alert>}
  </Stack>;
}
