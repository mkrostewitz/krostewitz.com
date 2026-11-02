"use client";

import {Alert, Stack, Typography} from "@mui/material";
import {LeadButton} from "./LeadUi";

const label = value => value ? value.replaceAll("_", " ") : "Not available";
export default function ApolloProgress({apollo, refreshing, onRefresh, onSequenceAction, busy = false, target}) {
  if (!apollo?.contactId) return null;
  const progress = apollo.progress;
  const attempt = apollo.lastEnrollment;
  return <Stack spacing={1.5} aria-label="Current Apollo status">
    <Typography component="h3" variant="subtitle2">Current Apollo status</Typography>
    <LeadButton disabled={refreshing || busy} onClick={onRefresh}>{refreshing ? "Refreshing Apollo status…" : "Refresh Apollo status"}</LeadButton>
    {apollo.progressError && <Alert severity="warning">{apollo.progressError} {progress ? "Showing the last successful read below." : "Progress has not been loaded."}</Alert>}
    {progress ? <>
      {progress.configuredSender && <Typography variant="body2">Configured sending account: <strong>{progress.configuredSender.email}</strong></Typography>}
      <Typography variant="body2">Contact stage: <strong>{progress.stageName || progress.stageId || "Not set"}</strong></Typography>
      {progress.sequences.map(sequence => <Stack key={sequence.id} spacing={.5} sx={{border: 1, borderColor: "divider", borderRadius: 1, p: 1.5}}>
        <Typography variant="body2"><strong>{sequence.name}</strong></Typography>
        <Typography variant="body2">Sending account: {sequence.senderEmail || sequence.senderAccountId || "Not reported by Apollo"}</Typography>
        {sequence.senderStatus === "mismatch" && <Alert severity="warning">This enrollment uses a different sending account from Integrations. Change its sender in Apollo. Syncing contact details does not reassign an existing enrollment.</Alert>}
        {sequence.senderStatus === "unknown" && <Typography variant="caption">Sending account could not be verified against Integrations.</Typography>}
        <Typography variant="body2">Sequence status: {label(sequence.status)}</Typography>
        <Typography variant="body2">Current step: {sequence.stepNumber !== null ? `${sequence.stepNumber}${sequence.stepType ? ` · ${label(sequence.stepType)}` : ""}` : sequence.stepId ? `Apollo step ${sequence.stepId}` : "Not reported by Apollo"}</Typography>
        {onSequenceAction && sequence.status !== "removed" && <Stack direction="row" spacing={1} sx={{flexWrap: "wrap", gap: 1}}>
          <LeadButton disabled={busy || refreshing || ["paused", "stopped", "finished"].includes(sequence.status)} onClick={() => onSequenceAction("pause", sequence)}>Pause future emails</LeadButton>
          <LeadButton disabled={busy || refreshing} onClick={() => onSequenceAction("remove", sequence)}>Remove from sequence</LeadButton>
          <LeadButton disabled={busy || refreshing || !target || target.sequenceId === sequence.id} onClick={() => onSequenceAction("move", sequence)}>Move to selected sequence</LeadButton>
        </Stack>}
        {sequence.reason && <Typography variant="body2">Reason: {label(sequence.reason)}</Typography>}
      </Stack>)}
      {!progress.sequences.length && <Typography variant="body2">{progress.membershipsKnown ? "Apollo reports no sequence memberships for this contact." : "Apollo did not return sequence membership information."}</Typography>}
      {progress.warnings.map(message => <Alert key={message} severity="warning">{message}</Alert>)}
      <Typography variant="caption" color="text.secondary">Read from Apollo: {new Date(progress.checkedAt).toLocaleString()}</Typography>
    </> : !apollo.progressError && <Typography variant="body2">Loading sequence memberships and contact stage…</Typography>}
    {attempt && <Typography variant="body2">Last enrollment attempt: {label(attempt.status)} · {new Date(attempt.attemptedAt).toLocaleString()}. {attempt.message}</Typography>}
  </Stack>;
}
