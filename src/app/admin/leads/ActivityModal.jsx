"use client";

import { Dialog, DialogContent, Typography, MenuItem } from "@mui/material";
import { LeadField, LeadButton, LeadScope } from "./LeadUi";
import { useState } from "react";
import { CLOSED_STATUSES, localDay, suggestedFollowUp } from "../../lib/leadOutreach.mjs";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";
const ACTIVITIES = {
  call: {
    label: "Phone call",
    type: "call",
    channel: "phone"
  },
  linkedin_message: {
    label: "LinkedIn message",
    type: "message_sent",
    channel: "linkedin"
  },
  connection_requested: {
    label: "LinkedIn connection request",
    type: "connection_requested",
    channel: "linkedin"
  },
  connection_accepted: {
    label: "LinkedIn connection accepted",
    type: "connection_accepted",
    channel: "linkedin"
  },
  followed: {
    label: "Followed on LinkedIn",
    type: "followed",
    channel: "linkedin"
  },
  email: {
    label: "Email",
    type: "email_sent",
    channel: "email"
  },
  meeting: {
    label: "Meeting",
    type: "meeting",
    channel: "other"
  },
  note: {
    label: "Note",
    type: "note",
    channel: "other"
  }
};
export default function ActivityModal({
  lead,
  saving,
  onSave,
  onClose,
  draft = false,
  initialAction
}) {
  const [kind, setKind] = useState(() => Object.keys(ACTIVITIES).find(key => ACTIVITIES[key].type === initialAction?.type && ACTIVITIES[key].channel === initialAction?.channel) || "call");
  const [occurredOn, setOccurredOn] = useState(() => initialAction?.occurredOn || localDay());
  const [text, setText] = useState(initialAction?.text || "");
  const [override, setOverride] = useState(null);
  const suggestion = suggestedFollowUp(lead, {
    occurredOn
  });
  const followUpOn = override === null ? suggestion || "" : override;
  const closed = CLOSED_STATUSES.includes(lead.status);
  async function submit(event) {
    event.preventDefault();
    const {
      type,
      channel
    } = ACTIVITIES[kind];
    const result = await onSave({
      action: {
        type,
        channel,
        occurredOn,
        text
      },
      followUpOn: closed ? null : followUpOn || null
    });
    if (result) onClose();
  }
  return <Dialog aria-labelledby="activity-title" open maxWidth="sm" onClose={() => {
    if (!saving) onClose();
  }}><DialogContent sx={{
      display: "grid",
      gap: 2
    }}>


      <form onSubmit={submit} className={outreach.form}>
        <Typography id="activity-title" component="h2" variant="h6">{initialAction ? "Edit activity" : "Add activity"}</Typography>
        {draft && <Typography className={styles.muted} component="p" variant="body2">This activity will be saved together with the new lead.</Typography>}
        <Typography className={styles.muted} component="p" variant="body2">{lead.name || lead.email}</Typography>
        <LeadScope disabled={saving}>
          <LeadField aria-label="Activity" value={kind} onChange={event => setKind(event.target.value)} label={<>Activity
            </>} select={true}>
              {Object.entries(ACTIVITIES).map(([value, activity]) => <MenuItem key={value} value={value}>{activity.label}</MenuItem>)}
            </LeadField>
          <LeadField type="date" required max={localDay()} value={occurredOn} onChange={event => setOccurredOn(event.target.value)} label={<>Activity date
            </>}></LeadField>
          <LeadField rows={4} required={kind === "note"} maxLength={4000} value={text} onChange={event => setText(event.target.value)} placeholder="What happened, and what should happen next?" label={<>Note {kind !== "note" && "(optional)"}
            </>} multiline={true}></LeadField>
          {!closed && <>
            <LeadField type="date" value={followUpOn} onChange={event => setOverride(event.target.value)} label={<>Next follow-up date
              </>}></LeadField>
            <Typography className={styles.muted} component="p" variant="body2">Suggested: {suggestion || "add an activity date"}, five days after the latest activity. Older activities do not move this suggestion backwards.</Typography>
            <div className={styles.buttonRow}>
              <LeadButton type="button" onClick={() => setOverride(null)} variant="outlined">Use suggested date</LeadButton>
              <LeadButton type="button" onClick={() => setOverride(lead.followUpOn || "")} variant="outlined">Keep current reminder</LeadButton>
            </div>
          </>}
          <div className={styles.buttonRow}>
            <LeadButton type="submit" variant="contained">{saving ? "Saving…" : draft ? "Use activity" : "Save activity"}</LeadButton>
            <LeadButton type="button" onClick={onClose} variant="outlined">Cancel</LeadButton>
          </div>
        </LeadScope>
      </form>
    </DialogContent></Dialog>;
}
