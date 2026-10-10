"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {localDay, suggestedFollowUp} from "../../lib/leadOutreach.mjs";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";

const ACTIVITIES = {
  call: {label: "Phone call", type: "call", channel: "phone"},
  linkedin_message: {label: "LinkedIn message", type: "message_sent", channel: "linkedin"},
  connection_requested: {label: "LinkedIn connection request", type: "connection_requested", channel: "linkedin"},
  connection_accepted: {label: "LinkedIn connection accepted", type: "connection_accepted", channel: "linkedin"},
  followed: {label: "Followed on LinkedIn", type: "followed", channel: "linkedin"},
  email: {label: "Email", type: "email_sent", channel: "email"},
  meeting: {label: "Meeting", type: "meeting", channel: "other"},
  note: {label: "Note", type: "note", channel: "other"},
};

export default function ActivityModal({lead, saving, onSave, onClose}) {
  const dialog = useRef(null);
  const [kind, setKind] = useState("call");
  const [occurredOn, setOccurredOn] = useState(localDay);
  const [text, setText] = useState("");
  const [override, setOverride] = useState(null);
  const suggestion = suggestedFollowUp(lead, {occurredOn});
  const followUpOn = override === null ? suggestion || "" : override;
  const closed = ["won", "lost"].includes(lead.status);

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    return () => element.close();
  }, []);

  async function submit(event) {
    event.preventDefault();
    const {type, channel} = ACTIVITIES[kind];
    const result = await onSave({
      action: {type, channel, occurredOn, text},
      followUpOn: closed ? null : followUpOn || null,
    });
    if (result) onClose();
  }

  return createPortal(
    <dialog ref={dialog} className={outreach.activityModal} aria-labelledby="activity-title"
      onCancel={(event) => {event.preventDefault(); if (!saving) onClose();}}
      onKeyDown={(event) => {if (event.key === "Escape") event.stopPropagation();}}>
      <form onSubmit={submit} className={outreach.form}>
        <h2 id="activity-title">Add activity</h2>
        <p className={styles.muted}>{lead.name || lead.email}</p>
        <fieldset className={outreach.fieldset} disabled={saving}>
          <label className={styles.field}>Activity
            <select aria-label="Activity" value={kind} onChange={(event) => setKind(event.target.value)}>
              {Object.entries(ACTIVITIES).map(([value, activity]) => <option key={value} value={value}>{activity.label}</option>)}
            </select>
          </label>
          <label className={styles.field}>Activity date
            <input type="date" required max={localDay()} value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} />
          </label>
          <label className={styles.field}>Note {kind !== "note" && "(optional)"}
            <textarea rows={4} required={kind === "note"} maxLength={4000} value={text} onChange={(event) => setText(event.target.value)} placeholder="What happened, and what should happen next?" />
          </label>
          {!closed && <>
            <label className={styles.field}>Next follow-up date
              <input type="date" value={followUpOn} onChange={(event) => setOverride(event.target.value)} />
            </label>
            <p className={styles.muted}>Suggested: {suggestion || "add an activity date"}, five days after the latest activity. Older activities do not move this suggestion backwards.</p>
            <div className={styles.buttonRow}>
              <button type="button" className={styles.secondaryButton} onClick={() => setOverride(null)}>Use suggested date</button>
              <button type="button" className={styles.secondaryButton} onClick={() => setOverride(lead.followUpOn || "")}>Keep current reminder</button>
            </div>
          </>}
          <div className={styles.buttonRow}>
            <button className={styles.button} type="submit">{saving ? "Saving…" : "Save activity"}</button>
            <button className={styles.secondaryButton} type="button" onClick={onClose}>Cancel</button>
          </div>
        </fieldset>
      </form>
    </dialog>, document.body
  );
}
