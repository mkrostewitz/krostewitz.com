"use client";

import {useRef, useState} from "react";
import {Alert, Box, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography} from "@mui/material";
import {Plus, X} from "lucide-react";
import {FormField, FormButton, FormIconButton, FormScope} from "../components/forms/FormFields";
import ApolloOptionSelect from "./ApolloOptionSelect";

export default function ApolloListSettings({configured, version, value, listName, onChange, onBusy}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("website_leads");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  async function create(event) {
    event.preventDefault();
    event.stopPropagation();
    if (pending.current || !name.trim()) return;
    pending.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/integrations/apollo/options", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({name}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to create list.");
      onChange(data.option.id, data.option.label);
      setRevision((current) => current + 1);
      setMessage(`Created ${data.option.label}. Save settings to use it for leads.`);
      setOpen(false);
    } catch (failure) { setError(failure.message || "Unable to create list. Refresh before retrying."); }
    finally { pending.current = false; setBusy(false); onBusy(false); }
  }
  return <FormScope disabled={!configured}>
    <Stack spacing={1.5}>
      {!configured && <Alert severity="info">Save your API key first to load or create lists.</Alert>}
      <Stack direction={{xs: "column", sm: "row"}} spacing={1} sx={{alignItems: {sm: "flex-start"}}}>
        <Box sx={{flex: 1, minWidth: 0}}>{configured && <ApolloOptionSelect key={`${version}-${revision}`} kind="lists" label="Destination list"
          value={value} savedLabel={listName} onChange={(id, option) => onChange(id, option?.label || "")} />}</Box>
        <FormButton variant="outlined" startIcon={<Plus size={17} />} onClick={() => {setError(""); setOpen(true);}} sx={{whiteSpace: "nowrap", minHeight: 44}}>Create list</FormButton>
      </Stack>
      {message && <Alert severity="success">{message}</Alert>}
    </Stack>
    <Dialog open={open} onClose={() => {if (!busy) setOpen(false);}} aria-labelledby="create-apollo-list-title">
      <Box component="form" onSubmit={create}>
        <DialogTitle id="create-apollo-list-title" sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
          Create contact list<FormIconButton label="Close create list" disabled={busy} onClick={() => setOpen(false)}><X size={20} /></FormIconButton>
        </DialogTitle>
        <DialogContent><Stack spacing={2} sx={{pt: 1}}>
          <Typography variant="body2" color="text.secondary">Create an empty list in Apollo. You can add contacts from the lead form.</Typography>
          <FormField autoFocus required label="List name" value={name} disabled={busy} slotProps={{htmlInput: {maxLength: 200}}} onChange={(event) => setName(event.target.value)} />
          {error && <Alert severity="error">{error}</Alert>}
        </Stack></DialogContent>
        <DialogActions sx={{px: 3, pb: 2.5}}>
          <FormButton disabled={busy} onClick={() => setOpen(false)}>Cancel</FormButton>
          <FormButton type="submit" variant="contained" busy={busy} disabled={!name.trim()}>{busy ? "Creating…" : "Create list"}</FormButton>
        </DialogActions>
      </Box>
    </Dialog>
  </FormScope>;
}
