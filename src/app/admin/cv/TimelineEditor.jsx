"use client";

import {useEffect, useState} from "react";
import {TIMELINE_LANGUAGES, TIMELINE_LIMITS} from "../../lib/cvTimelineData.mjs";
import styles from "../admin.module.css";

const labels = {period: "Period", title: "Title / role", location: "Location", detail: "Description"};

export default function TimelineEditor() {
  const [entries, setEntries] = useState([]);
  const [revision, setRevision] = useState(null);
  const [language, setLanguage] = useState("en");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/admin/cv-timeline", {cache: "no-store", signal: controller.signal});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load timeline.");
        setEntries(data.entries);
        setRevision(data.revision);
      } catch (error) {
        if (!controller.signal.aborted) setError(error.message);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [attempt]);

  function update(id, field, value) {
    setMessage("");
    setEntries((current) => current.map((entry) => entry.id === id ? {
      ...entry, translations: {...entry.translations, [language]: {...entry.translations[language], [field]: value}},
    } : entry));
  }

  function move(index, offset) {
    setEntries((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/cv-timeline", {
        method: "PUT", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({entries, revision}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to save timeline.");
      setEntries(data.entries);
      setRevision(data.revision);
      setMessage("CV timeline saved.");
    } catch (error) { setError(error.message); }
    finally { setSaving(false); }
  }

  return (
    <section className={styles.profilePanel} aria-busy={loading || saving}>
      <div className={styles.panelHeader}>
        <div className={styles.titleBlock}>
          <h2>CV timeline</h2>
          <p className={styles.muted}>Add and edit career entries in their display order. Save to publish your changes.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {loading ? <p>Loading timeline…</p> : revision === null ? (
        <button type="button" className={styles.secondaryButton} onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      ) : (
        <fieldset disabled={saving} style={{border: 0, padding: 0, margin: 0, minWidth: 0}}>
          <label className={styles.field}>
            <span className={styles.fieldLabel}>Language</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en">English</option><option value="de">German</option>
            </select>
          </label>
          <p className={styles.muted}>Enter a title and period in at least one language. Incomplete translations use the other language.</p>
          <div className={styles.skillEditorList}>
            {entries.map((entry, index) => {
              const translation = entry.translations[language] || {};
              return (
                <article key={entry.id} className={styles.skillEditorCard}>
                  <div className={styles.skillEditorHeader}>
                    <h3>{translation.title || `Entry ${index + 1}`}</h3>
                    <div className={styles.buttonRow}>
                      <button type="button" className={styles.secondaryButton} disabled={index === 0} aria-label={`Move entry ${index + 1} up`} onClick={() => move(index, -1)}>↑</button>
                      <button type="button" className={styles.secondaryButton} disabled={index === entries.length - 1} aria-label={`Move entry ${index + 1} down`} onClick={() => move(index, 1)}>↓</button>
                      <button type="button" className={styles.secondaryButton} onClick={() => {
                        if (window.confirm("Remove this entry in both languages? Save to publish the removal.")) {
                          setEntries((current) => current.filter((item) => item.id !== entry.id));
                          setMessage("");
                        }
                      }}>Remove</button>
                    </div>
                  </div>
                  {Object.entries(TIMELINE_LIMITS).map(([field, limit]) => (
                    <label key={field} className={styles.field}>
                      <span className={styles.fieldLabel}>{labels[field]}</span>
                      {field === "detail" ? (
                        <textarea rows={5} maxLength={limit} value={translation[field] || ""} onChange={(event) => update(entry.id, field, event.target.value)} />
                      ) : (
                        <input maxLength={limit} value={translation[field] || ""} onChange={(event) => update(entry.id, field, event.target.value)} />
                      )}
                    </label>
                  ))}
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Highlights (one per line)</span>
                    <textarea rows={5} value={(translation.highlights || []).join("\n")} onChange={(event) => update(entry.id, "highlights", event.target.value.split("\n"))} />
                  </label>
                </article>
              );
            })}
          </div>
          {!entries.length && <p>No timeline entries. Add an entry to get started.</p>}
          <div className={styles.editorActions}>
            <button type="button" className={styles.secondaryButton} disabled={entries.length >= 100} onClick={() => {
              setEntries((current) => [...current, {id: crypto.randomUUID(), translations: Object.fromEntries(TIMELINE_LANGUAGES.map((code) => [code, {period: "", title: "", location: "", detail: "", highlights: []}]))}]);
              setMessage("");
            }}>Add entry</button>
            <button type="button" className={styles.button} onClick={save}>{saving ? "Saving…" : "Save timeline"}</button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
