"use client";

import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";

export default function DeleteLeadModal({lead, onClose, onDeleted}) {
  const dialog = useRef(null);
  const [deleting, setDeleting] = useState(false);
  const {showSnackbar} = useSnackbar();

  useEffect(() => {
    const element = dialog.current;
    element.showModal();
    element.querySelector("button")?.focus();
    return () => element.close();
  }, []);

  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}`, {method: "DELETE"});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to delete lead.");
      onDeleted();
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setDeleting(false);
    }
  }

  return createPortal(
    <dialog ref={dialog} className={outreach.activityModal}
      aria-labelledby="delete-lead-title" aria-describedby="delete-lead-description"
      onKeyDown={(event) => {if (event.key === "Escape") event.stopPropagation();}}
      onCancel={(event) => {event.preventDefault(); if (!deleting) onClose();}}>
      <h2 id="delete-lead-title">Delete lead?</h2>
      <p id="delete-lead-description">Permanently delete {lead.name || lead.email || "this lead"}, including all activity history and follow-up reminders? This cannot be undone.</p>
      <div className={styles.buttonRow}>
        <button type="button" className={styles.secondaryButton} disabled={deleting} onClick={onClose}>Cancel</button>
        <button type="button" className={styles.dangerButton} disabled={deleting} onClick={remove}>{deleting ? "Deleting…" : "Delete lead"}</button>
      </div>
    </dialog>, document.body
  );
}
