"use client";

import Link from "next/link";
import { Typography, Alert, Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";
import {useLeadRequirements} from "./LeadRequirements";
import {missingLeadFields, LEAD_REQUIREMENT_FIELDS} from "../../lib/leadRequirements.mjs";
import ApolloProgress from "./ApolloProgress";
import ApolloOptionSelect from "../integrations/ApolloOptionSelect";
import {FormScope} from "../components/forms/FormFields";
import { LeadCheckbox, LeadButton } from "./LeadUi";
import { resolveApolloSequence, apolloLeadLabels, savedApolloSequence } from "../../lib/apolloRouting.mjs";
import { useEffect, useRef, useState } from "react";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";
export default function ApolloOutreach({
  contact,
  settings,
  leadId,
  apollo,
  categories = []
}) {
  const {requiredFields, apolloRequiredFields = []} = useLeadRequirements();
  const listName = settings.listName || "website_leads";
  const [sequenceChoice, setSequence] = useState(undefined);
  const [submitted, setSubmitted] = useState("");
  const labels = apolloLeadLabels(categories);
  const [enroll, setEnroll] = useState(false);
  const missing = missingLeadFields(contact, categories, [...new Set([...requiredFields, ...apolloRequiredFields, ...(enroll ? ["email"] : [])])]);

  const [busy, setBusy] = useState(false);
  const [sequenceAction, setSequenceAction] = useState(null);
  const [actionMessage, setActionMessage] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [remoteStatus, setRemoteStatus] = useState(null);
  const syncStatus = remoteStatus || apollo;
  const sequence = sequenceChoice === undefined ? savedApolloSequence(syncStatus) : sequenceChoice;
  const matched = resolveApolloSequence(settings, categories, "", contact.source);
  const target = sequence ? {sequenceId: sequence.id, sequenceName: sequence.label} : matched;
  const linked = Boolean(result?.contactId || syncStatus?.contactId);
  const requestBody = JSON.stringify({leadId, contact, enroll, sequenceId: sequence?.id || "", categories});
  async function refreshProgress() {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/leads/apollo?leadId=${encodeURIComponent(leadId)}&refresh=1`, {cache: "no-store"});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to refresh Apollo status.");
      setRemoteStatus(data.apollo);
    } catch (failure) { setError(failure.message); }
    finally { setRefreshing(false); }
  }
  useEffect(() => {
    if (!leadId) return;
    const abort = new AbortController();
    let timer;
    async function refresh() {
      try {
        const response = await fetch(`/api/admin/leads/apollo?leadId=${encodeURIComponent(leadId)}`, {
          cache: "no-store",
          signal: abort.signal
        });
        if (response.ok) {
          const data = await response.json();
          if (!abort.signal.aborted) setRemoteStatus(data.apollo);
        }
      } catch {/* Keep the last known sync status during a connection failure. */}
      if (!abort.signal.aborted) timer = setTimeout(refresh, 5000);
    }
    void refresh();
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [leadId, apollo?.requestId, result]);
  async function send() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setResult(null);
    setError("");
    try {
      const response = await fetch("/api/admin/leads/apollo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: requestBody
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send this contact to Apollo.");
      setSubmitted(requestBody);
      setResult(data.result);
    } catch (failure) {
      setError(failure.message || "No response received. Check the contact in Apollo before retrying.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function manageSequence() {
    if (pending.current || !sequenceAction) return;
    pending.current = true;
    setBusy(true); setError(""); setActionMessage(""); setResult(null); setSubmitted("");
    try {
      const response = await fetch("/api/admin/leads/apollo/sequence", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({leadId, action: sequenceAction.action, sequenceId: sequenceAction.sequence.id, targetSequenceId: sequenceAction.target?.sequenceId}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to change sequence membership.");
      setRemoteStatus(data.apollo); setActionMessage(data.message); setEnroll(false);
      if (sequenceAction.action === "move") setSequence({id: sequenceAction.target.sequenceId, label: sequenceAction.target.sequenceName});
    } catch (failure) { setError(failure.message); }
    finally { setSequenceAction(null); pending.current = false; setBusy(false); }
  }
  const done = submitted === requestBody && result?.listAdded && result?.labelsAdded && (!enroll || (result.sequenceId === target?.sequenceId && ["enrolled", "already_enrolled"].includes(result.sequenceStatus)));
  return <section className={outreach.apolloActions} aria-label="Apollo list and sequence" aria-busy={busy}>
    <Typography className={styles.muted} component="p" variant="body2">{linked ? "Update this linked Apollo contact with the current details and tags." : "Save and link this contact in Apollo."} List: <strong>{listName}</strong>. Save changes syncs linked contacts in the background. Use the button below to sync now or explicitly enroll in a selected sequence.</Typography>
    {!settings.sequenceEnabled && <Alert severity="info">
      Sequence enrollment is turned off. In <Link href="/admin/integrations" target="_blank" rel="noopener noreferrer">Apollo Integrations</Link>, enable <strong>Sequence enrollment</strong>, choose a sending account, and save settings. Then reopen this lead to choose an event or personal-conversation sequence. Category rules and a fallback sequence are optional.
    </Alert>}
    <ApolloProgress apollo={syncStatus} refreshing={refreshing} onRefresh={refreshProgress} busy={busy} target={settings.sequenceEnabled ? target : null}
      onSequenceAction={(action, sequence) => setSequenceAction({action, sequence, target})} />
    <Dialog open={Boolean(sequenceAction)} onClose={() => {if (!busy) setSequenceAction(null);}} fullWidth maxWidth="sm">
      <DialogTitle>{sequenceAction?.action === "move" ? "Move contact to another sequence" : sequenceAction?.action === "pause" ? "Pause future emails" : "Remove contact from sequence"}</DialogTitle>
      <DialogContent>
        <Typography>{sequenceAction?.action === "move"
          ? `Remove this contact from “${sequenceAction.sequence.name}” and enroll them in “${sequenceAction.target?.sequenceName}”? The new sequence may start sending emails. Save any lead edits before moving.`
          : sequenceAction?.action === "pause" ? `Stop future steps for this contact in “${sequenceAction.sequence.name}”? You can resume them in Apollo.`
          : `Remove this contact from “${sequenceAction?.sequence.name}”? The contact stays in your Apollo list.`}</Typography>
        <Typography variant="body2" sx={{mt: 2}}>Already sent emails cannot be recalled. Other sequence memberships are unchanged.</Typography>
      </DialogContent>
      <DialogActions><LeadButton disabled={busy} onClick={() => setSequenceAction(null)}>Cancel</LeadButton><LeadButton disabled={busy} variant="contained" onClick={manageSequence}>{busy ? "Updating…" : sequenceAction?.action === "move" ? "Move contact" : sequenceAction?.action === "pause" ? "Pause contact" : "Remove contact"}</LeadButton></DialogActions>
    </Dialog>
    {actionMessage && <Alert severity="info">{actionMessage}</Alert>}
    {settings.sequenceEnabled && <>
      <FormScope disabled={busy}>
        <ApolloOptionSelect kind="sequences" label="Selected sequence" required={false}
          emptyLabel={matched ? `Source / contact type / fallback: ${matched.sequenceName}` : "Choose a custom sequence"}
          value={sequence?.id || ""} savedLabel={sequence?.label}
          onChange={(id, option) => {setSequence(id ? {id, label: option?.label || id} : null); setEnroll(false); setResult(null); setError("");}} />
      </FormScope>
      <Typography className={styles.muted} component="p" variant="body2">Your saved enrollment is shown here when available. To switch sequences, choose a destination here, then use “Move to selected sequence” on the old sequence above. Move uses saved lead details. Syncing keeps existing memberships; the checkbox below adds an enrollment without removing any existing sequence.</Typography>
      <LeadCheckbox checked={enroll} disabled={busy || !target} onChange={event => {setEnroll(event.target.checked); setResult(null);}} label="Enroll only in the selected sequence" />
    </>}
    {labels.length > 0 && <Typography className={styles.muted} component="p" variant="body2">Apollo Contact Type: {labels.join(", ")}.</Typography>}
    {settings.sequenceEnabled && !target && <Typography className={styles.muted} component="p" variant="body2">No category sequence matches. Choose a custom sequence above, or sync contact details without enrolling.</Typography>}
    {enroll && <Typography className={styles.muted} component="p" variant="body2">Sequence: {target?.sequenceName} ({sequence ? "custom selection" : target?.category || "fallback"}). Enrollment can start sending emails according to its Apollo schedule.</Typography>}
    <LeadButton type="button" disabled={busy || !leadId || missing.length > 0 || categories.length > 1 || done} onClick={send} variant="outlined">
      {busy ? "Syncing with Apollo…" : done ? "Synced with Apollo" : enroll ? "Sync and enroll in selected sequence" : linked ? "Sync contact with Apollo" : "Save and link to Apollo"}
    </LeadButton>
    {!leadId && <Typography className={styles.muted} component="p" variant="body2">Create the lead first, then reopen it to link Apollo.</Typography>}
    {(result?.contactId || syncStatus?.contactId) && <Typography className={styles.muted} component="p" variant="body2">Linked Apollo contact: {result?.contactId || syncStatus.contactId}</Typography>}
    {["pending", "syncing", "retrying"].includes(syncStatus?.status) && <Alert role="status" severity="info">{syncStatus.status === "retrying" ? "Apollo is temporarily unavailable. Your saved changes will be retried automatically." : "Apollo sync is queued or running in the background. You can close this form."}</Alert>}
    {syncStatus?.status === "synced" && <Typography className={styles.muted} component="p" variant="body2">Last synced: {new Date(syncStatus.lastSyncedAt).toLocaleString()}</Typography>}
    {syncStatus?.status === "error" && <Alert role="alert" severity="error">Site changes saved. Apollo sync needs retrying: {syncStatus.message}</Alert>}
    {categories.length > 1 && <Alert severity="warning">Choose one contact type before syncing this lead.</Alert>}
    {missing.length > 0 && <Alert severity="warning">Required for Apollo sync{enroll ? " and enrollment" : ""}: {missing.map(key => LEAD_REQUIREMENT_FIELDS[key]).join(", ")}. You can save locally when the lead requirements are complete.</Alert>}
    {result && <Typography role={result.listAdded ? "status" : "alert"} component="p" variant="body2">{result.message}</Typography>}
    {error && <Alert role="alert" severity="error">{error}</Alert>}
  </section>;
}
