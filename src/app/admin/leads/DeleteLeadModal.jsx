"use client";

import { Dialog, DialogContent, Typography } from "@mui/material";
import { LeadButton } from "./LeadUi";
import { useState } from "react";
import { useSnackbar } from "./LeadSnackbar";
import styles from "../admin.module.css";
export default function DeleteLeadModal({
  lead,
  onClose,
  onDeleted
}) {
  const [deleting, setDeleting] = useState(false);
  const {
    showSnackbar
  } = useSnackbar();
  async function remove() {
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/leads/${lead.id}`, {
        method: "DELETE"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to delete lead.");
      onDeleted();
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message
      });
    } finally {
      setDeleting(false);
    }
  }
  return <Dialog aria-labelledby="delete-lead-title" aria-describedby="delete-lead-description" open maxWidth="sm" onClose={() => {
    if (!deleting) onClose();
  }}><DialogContent sx={{
      display: "grid",
      gap: 2
    }}>


      <Typography id="delete-lead-title" component="h2" variant="h6">Delete lead?</Typography>
      <Typography id="delete-lead-description" component="p" variant="body2">Permanently delete {lead.name || lead.email || "this lead"}, including all activity history and follow-up reminders? This cannot be undone.</Typography>
      <div className={styles.buttonRow}>
        <LeadButton type="button" disabled={deleting} onClick={onClose} variant="outlined">Cancel</LeadButton>
        <LeadButton type="button" disabled={deleting} onClick={remove} variant="outlined" color="error">{deleting ? "Deleting…" : "Delete lead"}</LeadButton>
      </div>
    </DialogContent></Dialog>;
}
