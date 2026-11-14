"use client";

import { useState } from "react";
import { Autocomplete, Box, IconButton, TextField } from "@mui/material";
import { Pencil, X } from "lucide-react";
import { useLeadDisabled } from "./LeadUi";
const clean = value => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const key = value => clean(value).toLowerCase();
export default function LeadTagsAutocomplete({
  label,
  value,
  options,
  onChange,
  onEdit,
  formatValue = value => value,
  allowCreate = false,
  disabled = false,
  required = false,
  help,
  placeholder
}) {
  const inherited = useLeadDisabled();
  const [query, setQuery] = useState("");
  const choices = [...new Map([...options, ...value].map(option => [key(option), option])).values()];
  function update(values) {
    if (inherited || disabled) return;
    const canonical = values.map(item => choices.find(option => key(option) === key(item)) || clean(item)).filter(Boolean);
    onChange([...new Map(canonical.map(item => [key(item), item])).values()].slice(0, allowCreate ? 50 : undefined));
  }
  return <Autocomplete multiple freeSolo={allowCreate} autoSelect={allowCreate} filterSelectedOptions disableCloseOnSelect disabled={inherited || disabled} options={choices} value={value} inputValue={query} onInputChange={(_, input) => setQuery(input)} onChange={(_, values) => update(values)} isOptionEqualToValue={(a, b) => key(a) === key(b)} renderValue={onEdit ? (items, getItemProps) => items.map((item, index) => {
    const {key: itemKey, onDelete, disabled: itemDisabled, ...itemProps} = getItemProps({index});
    const blocked = inherited || disabled || itemDisabled;
    return <Box component="span" key={itemKey} {...itemProps} sx={{display: 'inline-flex', alignItems: 'center', gap: 0.25, pl: 1.25, pr: 0.25, py: 0.25, borderRadius: 4, bgcolor: 'action.selected', maxWidth: '100%'}}>
      <Box component="span" sx={{overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>{formatValue(item)}</Box>
      <IconButton type="button" size="small" disabled={blocked} aria-label={`Edit ${formatValue(item)}`} title={`Edit ${formatValue(item)}`}
        onMouseDown={event => {event.preventDefault(); event.stopPropagation();}}
        onKeyDown={event => event.stopPropagation()}
        onClick={event => {event.stopPropagation(); onEdit(item);}}><Pencil size={14} /></IconButton>
      {onDelete && <IconButton type="button" size="small" disabled={blocked} aria-label={`Remove ${formatValue(item)}`} title={`Remove ${formatValue(item)}`}
        onMouseDown={event => {event.preventDefault(); event.stopPropagation();}}
        onKeyDown={event => event.stopPropagation()}
        onClick={event => {event.stopPropagation(); onDelete(event);}}><X size={14} /></IconButton>}
    </Box>;
  }) : undefined} renderInput={params => <TextField {...params} label={label} required={required && !value.length} helperText={help} placeholder={placeholder || (allowCreate ? "Select or enter values…" : "Select values…")} slotProps={{
    ...params.slotProps,
    // The label marks the field as mandatory even when selected chips satisfy it.
    // Keep native input validation conditional: the text input is empty after selection.
    inputLabel: {
      ...params.slotProps.inputLabel,
      required
    },
    htmlInput: {
      ...params.slotProps.htmlInput,
      maxLength: 100
    }
  }} />} />;
}
