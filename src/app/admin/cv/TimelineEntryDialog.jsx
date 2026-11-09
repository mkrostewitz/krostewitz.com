"use client";

import {useState} from "react";
import {Alert, Autocomplete, Box, Button, Checkbox, FormControlLabel, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, LinearProgress, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography} from "@mui/material";
import {FileText, Languages, Trash2, Upload, X} from "lucide-react";
import {normalizeTimeline, TIMELINE_LIMITS} from "../../lib/cvTimelineData.mjs";
import {SITE_LANGUAGES} from "../../../lib/siteLanguages";
import TimelineRichTextEditor from "./TimelineRichTextEditor";
import {timelineEditorHtml} from "../../lib/timelineRichText.mjs";
import styles from "./timeline-editor.module.css";

import {initialTimelineDates, timelineDateInput, formatTimelinePeriod} from "../../lib/timelineDates.mjs";

const labels = {period: "Period", title: "Title / role", company: "Company", location: "Location", detail: "Role description"};

export default function TimelineEntryDialog({entry, isNew, initialLanguage, onSave, onClose, employerGroups = []}) {
  const [draft, setDraft] = useState(() => ({...structuredClone(entry), ...initialTimelineDates(entry)}));
  const [language, setLanguage] = useState(initialLanguage);
  const [operation, setOperation] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const busy = Boolean(operation);
  const translation = draft.translations[language] || {};
  const period = formatTimelinePeriod(draft, language);
  const documents = draft.documents || [];
  const update = (field, value) => setDraft(current => ({...current, translations: {...current.translations, [language]: {...current.translations[language], [field]: value}}}));
  const updateDocuments = change => setDraft(current => ({...current, documents: change(current.documents || [])}));
  const close = () => { if (!busy) onClose(); };

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setOperation("Uploading document…"); setError(""); setNotice("");
    try {
      if (!/\.pdf$/i.test(file.name) || file.size > 10 * 1024 * 1024) throw new Error("Choose a PDF up to 10 MB.");
      const body = new FormData(); body.append("file", file); body.append("purpose", "timeline-document");
      const response = await fetch("/api/admin/uploads", {method: "POST", body});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to upload document.");
      const asset = data.asset;
      updateDocuments(items => [...items, {id: asset.id, title: file.name.replace(/\.pdf$/i, "").slice(0, 200), fileName: asset.fileName, url: asset.url, size: asset.size, language}]);
      setNotice("Document uploaded. Save this station to publish it.");
    } catch (failure) { setError(failure.message); }
    finally { setOperation(""); }
  }

  async function translate(targetLanguage) {
    const target = draft.translations[targetLanguage];
    if (target && (target.title || target.company || target.location || target.detail || target.highlights?.some(Boolean)) && !window.confirm("Replace the existing translation? Review it before saving.")) return;
    setOperation("Translating station…"); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/cv-timeline/translate", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({sourceLanguage: language, targetLanguage, translation: {...translation, period}}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to translate station.");
      setDraft(current => ({...current, translations: {...current.translations, [targetLanguage]: data.translation}}));
      setLanguage(targetLanguage);
      setNotice("Translation ready. Review the fields before saving.");
    } catch (failure) { setError(failure.message); }
    finally { setOperation(""); }
  }

  async function save(event) {
    event.preventDefault(); setOperation("Saving station…"); setError("");
    try {
      const normalized = normalizeTimeline([draft])[0];
      await onSave(normalized);
    } catch (failure) { setError(failure.message); }
    finally { setOperation(""); }
  }

  return <Dialog open maxWidth="md" fullWidth onClose={close} aria-labelledby="timeline-entry-title" sx={theme => ({colorScheme: theme.palette.mode})}>
    <DialogTitle component="div" id="timeline-entry-header">
      <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between"}}>
        <Box>
          <Typography id="timeline-entry-title" component="h2" variant="h6">{isNew ? "Add career station" : "Edit career station"}</Typography>
          <Typography variant="body2" color="text.secondary">Role details, translations, and supporting documents.</Typography>
        </Box>
        <IconButton size="small" aria-label="Close station editor" disabled={busy} onClick={close}><X size={18} /></IconButton>
      </Stack>
    </DialogTitle>
    <form onSubmit={save} className={styles.dialogForm}>
      {busy && <LinearProgress aria-label={operation} />}
      <DialogContent dividers>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}
          {notice && <Alert severity="success">{notice}</Alert>}
          <Box>
            <FormControlLabel control={<Checkbox checked={Boolean(draft.showAfterMore)} disabled={busy} onChange={event => setDraft(current => ({...current, showAfterMore: event.target.checked}))} />} label="Show only after See more" />
            <Typography variant="caption" sx={{display: "block"}} color="text.secondary">Keep this experience out of the initial public timeline. Visitors can reveal it with See more at the bottom. Applies to both languages.</Typography>
          </Box>
          <Autocomplete freeSolo options={employerGroups} inputValue={draft.employerGroup || ""} disabled={busy}
            onInputChange={(_, value) => setDraft(current => ({...current, employerGroup: value}))}
            renderInput={params => <TextField {...params} label="Employer group (optional)" helperText="Use the same group, e.g. CAPTRON, for related roles. Leave empty to show this role separately. Groups appear at their first role’s position and apply to both languages." />} />
          <Box>
            <Typography variant="subtitle1" sx={{mb: 2, fontWeight: 600}}>Employment dates</Typography>
            <Stack direction={{xs: "column", sm: "row"}} spacing={2}>
              <TextField label="From" type="date" required fullWidth disabled={busy} value={timelineDateInput(draft.startDate)} onChange={event => setDraft(value => ({...value, startDate: event.target.value}))} slotProps={{inputLabel: {shrink: true}, htmlInput: {min: "0001-01-01", max: draft.current ? "9999-12-31" : timelineDateInput(draft.endDate) || "9999-12-31"}}} />
              <TextField label="To" type="date" required={!draft.current} fullWidth disabled={busy || draft.current} value={draft.current ? "" : timelineDateInput(draft.endDate)} onChange={event => setDraft(value => ({...value, endDate: event.target.value}))} slotProps={{inputLabel: {shrink: true}, htmlInput: {min: timelineDateInput(draft.startDate) || "0001-01-01", max: "9999-12-31"}}} />
            </Stack>
            <FormControlLabel control={<Checkbox checked={draft.current} disabled={busy} onChange={event => setDraft(value => ({...value, current: event.target.checked}))} />} label="Currently in this position" />
            <Typography variant="caption" sx={{display: "block", mt: 1}} color="text.secondary">Dates apply to both languages. {period || (entry.translations?.[language]?.period ? `Previous period: ${entry.translations[language].period}. Please select the dates.` : "Select the starting and ending date. Future dates are allowed.")}</Typography>
            {(draft.startDate?.length === 7 || draft.endDate?.length === 7) && <Typography variant="caption" sx={{display: "block", mt: 1}} color="text.secondary">Existing month-only dates use day 1 in the picker. They keep their original month precision unless you change them.</Typography>}
          </Box>
          <Box>
            <Stack direction={{xs: "column", sm: "row"}} spacing={2} sx={{mb: 2, justifyContent: "space-between"}}>
              <Tabs value={language} onChange={(_, value) => setLanguage(value)} aria-label="Station language">
                {SITE_LANGUAGES.map(lang => <Tab key={lang.code} value={lang.code} label={lang.label} disabled={busy} id={`station-tab-${lang.code}`} aria-controls="station-language-fields" />)}
              </Tabs>
              <Stack direction="row" sx={{alignItems: "center"}}>
                {SITE_LANGUAGES.filter(lang => lang.code !== language).map(lang => <Button key={lang.code} type="button" variant="outlined" startIcon={<Languages size={16} />} disabled={busy || !translation.title?.trim() || !period} onClick={() => void translate(lang.code)}>Translate to {lang.label}</Button>)}
              </Stack>
            </Stack>
            <Box role="tabpanel" id="station-language-fields" aria-labelledby={`station-tab-${language}`} sx={{display: "grid", gap: 2}}>
              <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", sm: "1fr 1fr"}, gap: 2}}>
                {["title", "company", "location"].map(field => <TextField key={field} label={labels[field]} autoFocus={field === "title"} disabled={busy} value={translation[field] || ""} onChange={event => update(field, event.target.value)} slotProps={{htmlInput: {maxLength: TIMELINE_LIMITS[field]}}} sx={field === "location" ? {gridColumn: "1 / -1"} : undefined} />)}
              </Box>
              <TimelineRichTextEditor key={`${language}-detail`} label="Role description" disabled={busy} value={timelineEditorHtml(translation, "detail")} onChange={html => update("detailHtml", html)} />
              <TimelineRichTextEditor key={`${language}-highlights`} label="Achievements / highlights" disabled={busy} value={timelineEditorHtml(translation, "highlights")} onChange={html => update("highlightsHtml", html)} />
              <Typography variant="caption" color="text.secondary">A title is required in at least one language. Missing translations fall back to the other language.</Typography>
            </Box>
          </Box>
          <Divider />
          <Stack component="section" aria-label="Attached documents" spacing={2}>
            <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between"}}>
              <Typography component="h3" variant="subtitle1" sx={{fontWeight: 600}}>Attached documents</Typography>
              <Chip size="small" label={`${documents.length} / 10`} variant="outlined" />
            </Stack>
            <Typography variant="body2" color="text.secondary">Case studies and supporting PDFs, up to 10 MB each. Documents appear in the public station details in both site languages.</Typography>
            {documents.map(doc => <Paper key={doc.id} variant="outlined" sx={{p: 2}}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} sx={{alignItems: "center"}}>
                  <FileText size={22} aria-hidden="true" />
                  <Box sx={{flex: 1, minWidth: 0}}>
                    <Typography variant="body2" sx={{fontWeight: 600, overflowWrap: "anywhere"}}>{doc.fileName}</Typography>
                    <Typography variant="caption" color="text.secondary">PDF · {(doc.size / 1024 / 1024).toFixed(2)} MB</Typography>
                  </Box>
                  <IconButton size="small" aria-label={`Remove ${doc.title}`} disabled={busy} onClick={() => updateDocuments(items => items.filter(item => item.id !== doc.id))}><Trash2 size={18} /></IconButton>
                </Stack>
                <Box sx={{display: "grid", gridTemplateColumns: {xs: "1fr", sm: "2fr 1fr"}, gap: 2}}>
                  <TextField label="Document title" required disabled={busy} value={doc.title} slotProps={{htmlInput: {maxLength: 200}}} onChange={event => updateDocuments(items => items.map(item => item.id === doc.id ? {...item, title: event.target.value} : item))} />
                  <TextField select label="Document language" disabled={busy} value={doc.language || ""} onChange={event => updateDocuments(items => items.map(item => item.id === doc.id ? {...item, language: event.target.value} : item))}>
                    <MenuItem value="">Language-neutral</MenuItem>
                    {SITE_LANGUAGES.map(lang => <MenuItem key={lang.code} value={lang.code}>{lang.label}</MenuItem>)}
                  </TextField>
                </Box>
                <Button component="a" href={doc.url} target="_blank" rel="noopener noreferrer" size="small" sx={{alignSelf: "flex-start"}}>Open PDF ↗</Button>
              </Stack>
            </Paper>)}
            <Box sx={{border: "1px dashed", borderColor: "divider", borderRadius: 2, p: 2.5, textAlign: "center", bgcolor: "action.hover"}}>
              <Button component="label" variant="outlined" startIcon={<Upload size={18} />} disabled={busy || documents.length >= 10}>
                {operation === "Uploading document…" ? "Uploading…" : "Upload PDF"}
                <input className={styles.fileInput} aria-label="Upload PDF" type="file" accept="application/pdf,.pdf" disabled={busy || documents.length >= 10} onChange={event => void upload(event)} />
              </Button>
              <Typography variant="caption" color="text.secondary" display="block" sx={{mt: 1}}>Save the station to publish attachments.</Typography>
            </Box>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{p: 2, gap: 1}}>
        <Button type="button" variant="outlined" disabled={busy} onClick={close}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy}>{operation === "Saving station…" ? "Saving…" : "Save station"}</Button>
      </DialogActions>
    </form>
  </Dialog>;
}
