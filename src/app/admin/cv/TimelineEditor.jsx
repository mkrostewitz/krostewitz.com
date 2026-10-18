"use client";

import {useEffect, useState} from "react";
import {TIMELINE_LANGUAGES, TIMELINE_LIMITS} from "../../lib/cvTimelineData.mjs";
import {SITE_LANGUAGES} from "../../../lib/siteLanguages";
import timelineStyles from "./timeline-editor.module.css";
import styles from "../admin.module.css";

const labels = {period: "Period", title: "Title / role", location: "Location", detail: "Role description"};

export default function TimelineEditor() {
  const [entries, setEntries] = useState([]);
  const [revision, setRevision] = useState(null);
  const [language, setLanguage] = useState("en");
  const [editingId, setEditingId] = useState(null);
  const [translating, setTranslating] = useState(false);
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

  async function translate(entry, targetLanguage) {
    const existing = entry.translations[targetLanguage];
    if (existing && (existing.title || existing.period || existing.location || existing.detail || existing.highlights?.some(Boolean)) &&
      !window.confirm("Replace the existing target-language fields with a new translation? You can review it before saving.")) return;
    setTranslating(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/cv-timeline/translate", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({sourceLanguage: language, targetLanguage, translation: entry.translations[language]}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to translate station.");
      setEntries((current) => current.map((item) => item.id === entry.id ? {
        ...item, translations: {...item.translations, [targetLanguage]: data.translation},
      } : item));
      setLanguage(targetLanguage);
      setMessage("Translation ready. Review the fields, then save the timeline to publish.");
    } catch (error) { setError(error.message); }
    finally { setTranslating(false); }
  }

  return (
    <section className={styles.profilePanel} aria-busy={loading || saving || translating}>
      <div className={styles.panelHeader}>
        <div className={styles.titleBlock}>
          <h2>CV timeline</h2>
          <p className={styles.muted}>Select a career station to edit its details and translations. Save to publish your changes.</p>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
      {translating && <p role="status">Translating station…</p>}
      {loading ? <p>Loading timeline…</p> : revision === null ? (
        <button type="button" className={styles.secondaryButton} onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      ) : (
        <fieldset disabled={saving || translating} className={timelineStyles.fieldset}>
          <div className={timelineStyles.timeline}>
            {entries.map((entry, index) => {
              const translation = entry.translations[language] || {};
              const preview = translation.title ? translation : Object.values(entry.translations).find((item) => item.title) || translation;
              const editing = editingId === entry.id;
              return (
                <article key={entry.id} className={timelineStyles.station}>
                  <div className={timelineStyles.period}>{preview.period || "Add period"}</div>
                  <span className={timelineStyles.marker} aria-hidden="true" />
                  <div className={timelineStyles.card}>
                    <button type="button" className={timelineStyles.preview} aria-expanded={editing} aria-controls={`editor-${entry.id}`} onClick={() => setEditingId(editing ? null : entry.id)}>
                      <h3>{preview.title || `New station ${index + 1}`}</h3>
                      <p className={timelineStyles.location}>{preview.location || "Add location"}</p>
                      <p className={timelineStyles.summary}>{preview.detail || "Add a role description and achievements."}</p>
                      <span className={timelineStyles.editLabel}>{editing ? "Close editor ↑" : "Edit station →"}</span>
                    </button>
                    <div className={timelineStyles.controls}>
                      <span className={styles.muted}>{SITE_LANGUAGES.map(({code}) => `${code.toUpperCase()}: ${entry.translations[code]?.title && entry.translations[code]?.period ? "Drafted" : "Incomplete"}`).join(" · ")}</span>
                      <div className={styles.buttonRow}>
                        <button type="button" className={styles.secondaryButton} disabled={index === 0} aria-label={`Move ${preview.title || "station"} up`} onClick={() => move(index, -1)}>↑</button>
                        <button type="button" className={styles.secondaryButton} disabled={index === entries.length - 1} aria-label={`Move ${preview.title || "station"} down`} onClick={() => move(index, 1)}>↓</button>
                        <button type="button" className={styles.secondaryButton} onClick={() => {
                          if (window.confirm("Remove this station in both languages? Save to publish the removal.")) {
                            setEntries((current) => current.filter((item) => item.id !== entry.id));
                            if (editing) setEditingId(null);
                            setMessage("");
                          }
                        }}>Remove</button>
                      </div>
                    </div>
                    {editing && (
                      <div id={`editor-${entry.id}`} className={timelineStyles.editor}>
                        <div className={styles.languageTabBar}>
                          <div className={styles.tabs} role="tablist" aria-label="Station language">
                            {SITE_LANGUAGES.map((item, tabIndex) => (
                              <button type="button" role="tab" key={item.code} id={`tab-${entry.id}-${item.code}`} aria-selected={item.code === language} aria-controls={`fields-${entry.id}`} tabIndex={item.code === language ? 0 : -1}
                                className={`${styles.tabButton} ${item.code === language ? styles.tabButtonActive : ""}`}
                                onClick={() => setLanguage(item.code)}
                                onKeyDown={(event) => {
                                  if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                                  event.preventDefault();
                                  const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? SITE_LANGUAGES.length - 1 : (tabIndex + (event.key === "ArrowRight" ? 1 : -1) + SITE_LANGUAGES.length) % SITE_LANGUAGES.length;
                                  const next = SITE_LANGUAGES[nextIndex].code;
                                  setLanguage(next);
                                  document.getElementById(`tab-${entry.id}-${next}`)?.focus();
                                }}>
                                {item.label}
                                <span className={styles.languageTabMeta}>{entry.translations[item.code]?.title && entry.translations[item.code]?.period ? "Drafted" : "Incomplete"}</span>
                              </button>
                            ))}
                          </div>
                          <div className={styles.buttonRow}>
                            {SITE_LANGUAGES.filter((item) => item.code !== language).map((target) => (
                              <button type="button" key={target.code} className={styles.secondaryButton} disabled={!translation.title?.trim() || !translation.period?.trim()} onClick={() => translate(entry, target.code)}>
                                Translate to {target.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <p className={styles.muted}>Translation includes the title, period, location, role description, and achievements. Review before publishing.</p>
                        <div role="tabpanel" id={`fields-${entry.id}`} aria-labelledby={`tab-${entry.id}-${language}`} className={timelineStyles.fields}>
                          {Object.entries(TIMELINE_LIMITS).map(([field, limit]) => (
                            <label key={field} className={styles.field}>
                              <span className={styles.fieldLabel}>{labels[field]}</span>
                              {field === "detail" ? (
                                <textarea rows={6} maxLength={limit} value={translation[field] || ""} onChange={(event) => update(entry.id, field, event.target.value)} />
                              ) : (
                                <input maxLength={limit} value={translation[field] || ""} onChange={(event) => update(entry.id, field, event.target.value)} />
                              )}
                            </label>
                          ))}
                          <label className={styles.field}>
                            <span className={styles.fieldLabel}>Achievements / highlights (one per line)</span>
                            <textarea rows={6} value={(translation.highlights || []).join("\n")} onChange={(event) => update(entry.id, "highlights", event.target.value.split("\n"))} />
                          </label>
                          <p className={styles.muted}>A title and period are required in at least one language. Incomplete translations use the other language on the public timeline.</p>
                          <button type="button" className={styles.secondaryButton} onClick={() => setEditingId(null)}>Done editing</button>
                        </div>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
          {!entries.length && <p>No career stations. Add a station to get started.</p>}
          <div className={styles.editorActions}>
            <button type="button" className={styles.secondaryButton} disabled={entries.length >= 100} onClick={() => {
              const id = crypto.randomUUID();
              setEntries((current) => [...current, {id, translations: Object.fromEntries(TIMELINE_LANGUAGES.map((code) => [code, {period: "", title: "", location: "", detail: "", highlights: []}]))}]);
              setEditingId(id);
              setMessage("");
            }}>Add station</button>
            <button type="button" className={styles.button} onClick={save}>{saving ? "Saving…" : "Save timeline"}</button>
          </div>
        </fieldset>
      )}
    </section>
  );
}
