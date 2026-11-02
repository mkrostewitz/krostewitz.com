"use client";

import {useEffect, useState} from "react";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import {CircleHelp} from "lucide-react";
import LeadCatalog from "../leads/LeadCatalog";
import ApolloListSettings from "./ApolloListSettings";
import ApolloSequenceRules from "./ApolloSequenceRules";
import ApolloOptionSelect from "./ApolloOptionSelect";
import ApolloSetupHelp from "./ApolloSetupHelp";
import {Alert, Box, Chip, Collapse, Divider, Paper, Stack, Typography} from "@mui/material";
import {FormField, FormToggle, FormButton, FormIconButton, FormScope} from "../components/forms/FormFields";

export default function ApolloSettings() {
  const {showSnackbar} = useSnackbar();
  const [optionsVersion, setOptionsVersion] = useState(0);
  const [creatingList, setCreatingList] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sources, setSources] = useState([]);
  const [leadTypes, setLeadTypes] = useState([]);
  const [settings, setSettings] = useState(null);
  const [enabled, setEnabled] = useState(false);
  const [actions, setActions] = useState({listId: "", listName: "website_leads", listEnabled: false, sequenceEnabled: false, sequenceId: "", emailAccountId: "", sequenceName: "", sequenceRules: [], sourceSequenceRules: []});
  const [apiKey, setApiKey] = useState("");
  const [removeKey, setRemoveKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/leads/catalog", {cache: "no-store", signal: abort.signal})
      .then(async response => {if (!response.ok) throw new Error("Unable to load saved contact types and sources."); return response.json();})
      .then(data => {setLeadTypes(data.leadTypes); setSources(data.sources);})
      .catch(failure => {if (failure.name !== "AbortError") setError(failure.message);});
    fetch("/api/admin/integrations/apollo", {cache: "no-store", signal: abort.signal})
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load Apollo settings.");
        setLeadTypes(data.leadTypes || []);
        setSettings(data.settings);
        setEnabled(data.settings.enabled);
        setActions({listId: data.settings.listId || "", listName: data.settings.listName || "website_leads", listEnabled: data.settings.listEnabled, sequenceEnabled: data.settings.sequenceEnabled, sequenceId: data.settings.sequenceId, emailAccountId: data.settings.emailAccountId, sequenceName: data.settings.sequenceName || "", sequenceRules: data.settings.sequenceRules || [], sourceSequenceRules: data.settings.sourceSequenceRules || []});
      }).catch((failure) => {if (failure.name !== "AbortError") setError(failure.message);});
    return () => abort.abort();
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/admin/integrations/apollo", {
        method: "PUT", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({enabled, apiKey, removeKey, ...actions}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save Apollo settings.");
      setSettings(data.settings);
      setEnabled(data.settings.enabled);
        setActions({listId: data.settings.listId || "", listName: data.settings.listName || "website_leads", listEnabled: data.settings.listEnabled, sequenceEnabled: data.settings.sequenceEnabled, sequenceId: data.settings.sequenceId, emailAccountId: data.settings.emailAccountId, sequenceName: data.settings.sequenceName || "", sequenceRules: data.settings.sequenceRules || [], sourceSequenceRules: data.settings.sourceSequenceRules || []});
      setOptionsVersion((version) => version + 1);
      setApiKey("");
      setRemoveKey(false);
      showSnackbar({type: "success", message: "Apollo settings saved."});
    } catch (failure) { setError(failure.message || "Unable to save Apollo settings."); }
    finally { setSaving(false); }
  }

  return <>
    <Paper component="form" variant="outlined" onSubmit={save} aria-busy={saving || (!settings && !error)} sx={{width: "100%", maxWidth: 880, p: {xs: 2, sm: 3}, borderRadius: 3}}>
      <Stack spacing={3}>
        <Stack direction="row" spacing={2} sx={{justifyContent: "space-between", alignItems: "center"}}>
          <Box><Typography variant="h6" component="h2">Apollo</Typography><Typography variant="body2" color="text.secondary">Contact enrichment and outreach</Typography></Box>
          <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
            <Chip size="small" label={settings?.available ? "Enabled" : "Disabled"} color={settings?.available ? "success" : "default"} variant="outlined" />
            <FormIconButton label="Apollo setup guide" aria-haspopup="dialog" onClick={() => setHelpOpen(true)}><CircleHelp size={21} /></FormIconButton>
          </Stack>
        </Stack>
        {error && <Alert severity="error">{error}</Alert>}
        {!settings && !error && <Typography variant="body2" color="text.secondary">Loading Apollo settings…</Typography>}
        <FormScope disabled={!settings || saving}>
          <Stack spacing={2.5}>
            <FormToggle label="Enable Apollo" description="Find work emails and phone numbers from your lead forms." checked={enabled} onChange={(event) => setEnabled(event.target.checked)} />
            <FormField id="apollo-api-key" label="API key" type="password" autoComplete="new-password" value={apiKey} disabled={removeKey}
              slotProps={{htmlInput: {maxLength: 2000, spellCheck: false}}}
              placeholder={settings?.configured ? "Leave blank to keep your saved key" : "Paste your Apollo API key"}
              helperText={settings?.configured ? "Key saved and encrypted. Leave blank to keep it." : "Stored encrypted. Open the setup guide for permissions."}
              onChange={(event) => setApiKey(event.target.value)} />
            {settings?.configured && <FormToggle label="Remove saved key" description="Disables Apollo when you save." checked={removeKey} onChange={(event) => {setRemoveKey(event.target.checked); setApiKey("");}} />}
            <Divider />
            <Typography variant="subtitle2" component="h3">Lead outreach</Typography>
            <LeadCatalog onChange={data => {setLeadTypes(data.leadTypes); setSources(data.sources);}} />
            <FormToggle label="Add to an Apollo list" description="Send contacts to your list with their lead categories." checked={actions.listEnabled} disabled={creatingList}
              onChange={(event) => setActions({...actions, listEnabled: event.target.checked, sequenceEnabled: event.target.checked && actions.sequenceEnabled})} />
            <Collapse in={actions.listEnabled} mountOnEnter unmountOnExit>
              <ApolloListSettings configured={settings?.configured && !removeKey} version={optionsVersion}
                value={actions.listId} listName={actions.listName} onBusy={setCreatingList}
                onChange={(listId, listName) => setActions((current) => ({...current, listId, listName}))} />
            </Collapse>
            <FormToggle label="Sequence enrollment" description={!settings?.configured ? "Save your API key to load sequences and sending accounts." : actions.listEnabled ? "Choose a sending account, then select a custom sequence on each lead or use optional category rules." : "Enable the list action first."}
              checked={actions.sequenceEnabled} disabled={!actions.listEnabled || !settings?.configured || removeKey}
              onChange={(event) => setActions({...actions, sequenceEnabled: event.target.checked})} />
            <Collapse in={actions.sequenceEnabled} mountOnEnter unmountOnExit>
              <Stack spacing={2.5} sx={{p: {xs: 1.5, sm: 2}, border: 1, borderColor: "divider", borderRadius: 2}}>
                <ApolloOptionSelect key={`accounts-${optionsVersion}`} kind="accounts" value={actions.emailAccountId}
                  onChange={(emailAccountId) => setActions((current) => ({...current, emailAccountId}))} />
                <ApolloSequenceRules source rules={actions.sourceSequenceRules} categories={sources}
                  onChange={sourceSequenceRules => setActions(current => ({...current, sourceSequenceRules}))} />
                <ApolloSequenceRules key={`rules-${optionsVersion}`} rules={actions.sequenceRules} categories={leadTypes}
                  onChange={(sequenceRules) => setActions((current) => ({...current, sequenceRules}))} />
                <ApolloOptionSelect key={`sequences-${optionsVersion}`} kind="sequences" label="Fallback sequence" required={false} value={actions.sequenceId}
                  onChange={(sequenceId, option) => setActions((current) => ({...current, sequenceId, sequenceName: option?.label || ""}))} />
                <Typography variant="caption" color="text.secondary">The fallback handles leads without a matching source or contact-type rule. Leave empty to choose a custom sequence on each lead or add to the list only.</Typography>
                {apiKey.trim() && <Alert severity="info">Options use your saved key. Save the replacement key to reload them.</Alert>}
              </Stack>
            </Collapse>
            <Divider />
            <Stack direction={{xs: "column", sm: "row"}} spacing={2} sx={{justifyContent: "space-between", alignItems: {sm: "center"}}}>
              <Typography variant="caption" color="text.secondary">Lookups may use Apollo credits. Review results before applying.</Typography>
              <FormButton type="submit" variant="contained" disabled={creatingList} busy={saving} sx={{flexShrink: 0}}>Save settings</FormButton>
            </Stack>
          </Stack>
        </FormScope>
      </Stack>
    </Paper>
    {helpOpen && <ApolloSetupHelp onClose={() => setHelpOpen(false)} />}
  </>;
}
