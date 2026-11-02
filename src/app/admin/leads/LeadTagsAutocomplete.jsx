"use client";

import { useState } from "react";
import { Autocomplete, TextField } from "@mui/material";
import { useLeadDisabled } from "./LeadUi";
const clean = value => value.normalize("NFKC").replace(/\s+/g, " ").trim();
const key = value => clean(value).toLowerCase();
export default function LeadTagsAutocomplete({
  label,
  value,
  options,
  onChange,
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
  return <Autocomplete multiple freeSolo={allowCreate} autoSelect={allowCreate} filterSelectedOptions disableCloseOnSelect disabled={inherited || disabled} options={choices} value={value} inputValue={query} onInputChange={(_, input) => setQuery(input)} onChange={(_, values) => update(values)} isOptionEqualToValue={(a, b) => key(a) === key(b)} renderInput={params => <TextField {...params} label={label} required={required && !value.length} helperText={help} placeholder={placeholder || (allowCreate ? "Select or enter values…" : "Select values…")} slotProps={{
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
