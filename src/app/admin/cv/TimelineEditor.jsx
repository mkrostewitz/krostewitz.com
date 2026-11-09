"use client";

import {useEffect, useState} from "react";
import {Alert, Button, Chip, Stack} from "@mui/material";
import {Plus} from "lucide-react";
import {TIMELINE_LANGUAGES} from "../../lib/cvTimelineData.mjs";
import {SITE_LANGUAGES} from "../../../lib/siteLanguages";
import TimelineEntryDialog from "./TimelineEntryDialog";
import timelineStyles from "./timeline-editor.module.css";
import styles from "../admin.module.css";

export default function TimelineEditor() {
  const [entries, setEntries] = useState([]);
  const [revision, setRevision] = useState(null);
  const [editor, setEditor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      try {
        const response = await fetch("/api/admin/cv-timeline", {cache: "no-store", signal: controller.signal});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load timeline.");
        setEntries(data.entries); setRevision(data.revision);
      } catch (failure) {
        if (!controller.signal.aborted) setError(failure.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  function openEditor(entry = null) {
    setError(""); setMessage("");
    const id = globalThis.crypto?.randomUUID?.() || `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setEditor({isNew: !entry, entry: entry || {id, documents: [], translations: Object.fromEntries(TIMELINE_LANGUAGES.map(code => [code, {period: "", title: "", location: "", detail: "", highlights: []}]))}});
  }

  function move(index, offset) {
    setEntries(current => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
    setDirty(true); setMessage("");
  }

  async function persist(nextEntries) {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/cv-timeline", {
        method: "PUT", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({entries: nextEntries, revision}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save timeline.");
      setEntries(data.entries); setRevision(data.revision); setDirty(false);
      setMessage("CV timeline saved.");
    } finally { setSaving(false); }
  }

  async function saveStation(entry) {
    const next = editor.isNew ? [...entries, entry] : entries.map(item => item.id === entry.id ? entry : item);
    await persist(next);
    setEditor(null);
  }

  return <section className={styles.profilePanel} aria-busy={loading || saving}>
    <div className={styles.panelHeader}>
      <div className={styles.titleBlock}>
        <h2>CV timeline</h2>
        <p className={styles.muted}>Manage career stations, translations, and supporting documents.</p>
      </div>
      <Button type="button" variant="contained" startIcon={<Plus size={18} />} disabled={loading || saving || revision === null || entries.length >= 100} onClick={() => openEditor()}>Add station</Button>
    </div>
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="success">{message}</Alert>}
    {loading ? <p>Loading timeline…</p> : revision === null ? <Button variant="outlined" onClick={() => setAttempt(value => value + 1)}>Retry</Button> : <>
      <div className={timelineStyles.timeline}>
        {entries.map((entry, index) => {
          const preview = Object.values(entry.translations).find(item => item.title) || {};
          return <article key={entry.id} className={timelineStyles.station}>
            <div className={timelineStyles.period}>{preview.period}</div>
            <span className={timelineStyles.marker} aria-hidden="true" />
            <div className={timelineStyles.card}>
              <button type="button" className={timelineStyles.preview} disabled={saving} aria-haspopup="dialog" onClick={() => openEditor(entry)}>
                <h3>{preview.title}</h3><p className={timelineStyles.location}>{preview.location}</p>
                <p className={timelineStyles.summary}>{preview.detail}</p><span className={timelineStyles.editLabel}>Edit station →</span>
              </button>
              <div className={timelineStyles.controls}>
                <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: "wrap"}}>
                  {SITE_LANGUAGES.map(lang => <Chip key={lang.code} size="small" variant="outlined" label={`${lang.code.toUpperCase()}: ${entry.translations[lang.code]?.title && entry.translations[lang.code]?.period ? "Drafted" : "Incomplete"}`} />)}
                  {entry.documents?.length > 0 && <Chip size="small" label={`${entry.documents.length} PDF${entry.documents.length === 1 ? "" : "s"}`} />}
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" disabled={saving || index === 0} aria-label={`Move ${preview.title} up`} onClick={() => move(index, -1)}>↑</Button>
                  <Button variant="outlined" disabled={saving || index === entries.length - 1} aria-label={`Move ${preview.title} down`} onClick={() => move(index, 1)}>↓</Button>
                  <Button variant="outlined" disabled={saving} onClick={() => {
                    if (window.confirm("Remove this station in both languages? Save the timeline to publish the removal.")) {
                      setEntries(current => current.filter(item => item.id !== entry.id)); setDirty(true); setMessage("");
                    }
                  }}>Remove</Button>
                </Stack>
              </div>
            </div>
          </article>;
        })}
      </div>
      {!entries.length && <p>No career stations. Add a station to get started.</p>}
      <Stack direction="row" spacing={2} sx={{alignItems: "center"}}>
        <Button variant="contained" disabled={saving || !dirty} onClick={() => void persist(entries).catch(failure => setError(failure.message))}>{saving ? "Saving…" : "Save timeline"}</Button>
        {dirty && <span className={styles.muted}>Unsaved ordering or removals</span>}
      </Stack>
    </>}
    {editor && <TimelineEntryDialog key={editor.entry.id} entry={editor.entry} isNew={editor.isNew} initialLanguage="en" onSave={saveStation} onClose={() => setEditor(null)} />}
  </section>;
}
