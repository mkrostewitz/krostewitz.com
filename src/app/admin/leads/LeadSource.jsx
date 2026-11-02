"use client";

import {useLeadRequirements} from "./LeadRequirements";
import { useEffect, useState } from "react";
import { Autocomplete, TextField, Alert, Stack } from "@mui/material";
import { useLeadDisabled } from "./LeadUi";
export default function LeadSource({
  value,
  onChange
}) {
  const {requiredFields} = useLeadRequirements();
  const disabled = useLeadDisabled();
  const [sources, setSources] = useState([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/leads/sources", {
      cache: "no-store",
      signal: abort.signal
    }).then(async response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(data => setSources(data.sources)).catch(failure => {
      if (failure.name !== "AbortError") setError(true);
    });
    return () => abort.abort();
  }, []);
  return <Stack spacing={1}>
    <Autocomplete freeSolo options={sources} inputValue={value} value={value || null} disabled={disabled} onInputChange={(_, input) => onChange(input)} onChange={(_, next) => onChange(next || "")} renderInput={params => <TextField {...params} label="Source" required={requiredFields.includes("source")} placeholder="Select or enter a source, e.g. LinkedIn" helperText="Choose one source. Saved choices are remembered and synced to Apollo’s Website Source field." slotProps={{
      ...params.slotProps,
      htmlInput: {
        ...params.slotProps.htmlInput,
        maxLength: 200
      }
    }} />} />
    {error && <Alert severity="info">Saved suggestions could not be loaded. You can still type a source.</Alert>}
  </Stack>;
}
