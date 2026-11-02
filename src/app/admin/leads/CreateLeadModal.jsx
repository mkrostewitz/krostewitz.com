"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Stack, Typography } from "@mui/material";
import { LeadIconButton } from "./LeadUi";
import OutreachForm from "./OutreachForm";
export default function CreateLeadModal({
  saving,
  onSave,
  onClose,
  companyNames,
  leadTypes
}) {
  const [footerTarget, setFooterTarget] = useState(null);
  return <Dialog open maxWidth="md" onClose={() => {
    if (!saving) onClose();
  }} aria-labelledby="create-lead-title">
    <DialogTitle component="div"><Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center"}}>
      <div><Typography variant="h6" id="create-lead-title">Add new lead</Typography><Typography variant="body2" color="text.secondary">Start with a contact. Add the context as you go.</Typography></div>
      <LeadIconButton disabled={saving} aria-label="Close new lead" onClick={onClose}><X size={18} /></LeadIconButton>
    </Stack></DialogTitle>
    <DialogContent dividers><OutreachForm footerTarget={footerTarget} leadTypes={leadTypes} companyNames={companyNames} saving={saving} onSave={onSave} onCancel={onClose} /></DialogContent>
    <DialogActions ref={setFooterTarget} sx={{
      p: 2
    }} />
  </Dialog>;
}
