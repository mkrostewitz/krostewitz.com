"use client";

import {useEffect, useState} from "react";
import {Dialog, DialogTitle, DialogContent, DialogActions, Button, IconButton, TextField, Alert, Typography, MenuItem} from "@mui/material";
import {X} from "lucide-react";
import {useTranslation} from "react-i18next";
import {loadRuntimeTranslations} from "../../../lib/i18n";
import LeadPhotoEditor from "../leads/LeadPhotoEditor";
import outreach from "../leads/outreach.module.css";
import AdminHeader from "../AdminHeader";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import {ReferencesDisplay} from "../../components/references/ReferencesSection";
import {MAX_REFERENCES, normalizeReferences, REFERENCE_LANGUAGES, REFERENCE_TEXT_LIMITS} from "../../lib/references.mjs";
import styles from "../admin.module.css";
import local from "./references-settings.module.css";

const EMPTY = {mode: "cards", items: []};
const FIELDS = {name: 160, role: 240, company: 240, relationship: 300, date: 10, linkedinUrl: 2000};

export default function ReferencesSettings({user}) {
  const {t, i18n} = useTranslation(undefined, {keyPrefix: "admin.references"});
  const {showSnackbar, closeSnackbar} = useSnackbar();
  const [references, setReferences] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState(null);
  const [editLanguage, setEditLanguage] = useState("en");
  const [translating, setTranslating] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftDirty, setDraftDirty] = useState(false);
  const [preview, setPreview] = useState(false);
  const [referencesEnabled, setReferencesEnabled] = useState(false);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/profile", {signal: controller.signal, cache: "no-store"});
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load references.");
        setReferences(normalizeReferences(data.profile?.references));
        setReferencesEnabled(data.profile?.referencesEnabled === true);
        setUpdatedAt(data.profile?.updatedAt || null);
      } catch (error) {
        if (error.name !== "AbortError") {
          setLoadError(true);
          showSnackbar({type: "error", message: error.message});
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [showSnackbar]);

  useEffect(() => {
    if (!dirty && !draftDirty) return;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, draftDirty]);

  function openEditor(item = null) {
    // This identifier is not a security token; support HTTP development origins too.
    const id = globalThis.crypto?.randomUUID?.() || `reference-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraft(item ? {...item} : {id, name: "", quote: "", sourceLanguage: "en", translations: {}});
    setEditLanguage(item?.sourceLanguage || "en");
    setDraftError("");
    setDraftDirty(false);
  }

  function updateDraft(field, value) {
    setDraft((current) => {
      if (field in REFERENCE_TEXT_LIMITS && editLanguage !== (current.sourceLanguage || "en")) {
        return {...current, translations: {...current.translations, [editLanguage]: {...current.translations?.[editLanguage], [field]: value}}};
      }
      return {...current, [field]: value};
    });
    setDraftDirty(true);
  }

  function closeEditor() {
    if (busy) return;
    setDraft(null);
    setDraftError("");
    setDraftDirty(false);
  }

  function move(index, direction) {
    setReferences((current) => {
      const items = [...current.items];
      [items[index], items[index + direction]] = [items[index + direction], items[index]];
      return {...current, items};
    });
    setDirty(true);
  }

  async function saveVisibility(enabled) {
    const previous = referencesEnabled;
    setReferencesEnabled(enabled);
    setSavingVisibility(true);
    closeSnackbar();
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({referencesEnabled: enabled}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || t("visibility.error"));
      const savedEnabled = data.profile?.referencesEnabled === true;
      setReferencesEnabled(savedEnabled);
      setUpdatedAt(data.profile?.updatedAt || null);
      showSnackbar({type: "success", message: t(savedEnabled ? "visibility.shown" : "visibility.hiddenMessage")});
    } catch (error) {
      setReferencesEnabled(previous);
      showSnackbar({type: "error", message: error.message || t("visibility.error")});
    } finally {
      setSavingVisibility(false);
    }
  }

  async function save(event, nextReferences = references, fromEditor = false) {
    event.preventDefault();
    if (fromEditor) setDraftError("");
    setBusy(true);
    try {
      const normalized = normalizeReferences(nextReferences, {strict: true});
      const response = await fetch("/api/admin/profile", {
        method: "PUT", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({references: normalized}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("saveError"));
      setReferences(data.profile.references);
      setUpdatedAt(data.profile.updatedAt || null);
      setDirty(false);
      if (fromEditor) {
        setDraft(null);
        setDraftDirty(false);
      }
      showSnackbar({type: "success", message: t("saved")});
    } catch (error) {
      if (fromEditor) setDraftError(error.message);
      else showSnackbar({type: "error", message: error.message});
    } finally { setBusy(false); }
  }

  function saveDraft(event) {
    const exists = references.items.some((item) => item.id === draft.id);
    const items = exists ? references.items.map((item) => item.id === draft.id ? draft : item) : [...references.items, draft];
    void save(event, {...references, items}, true);
  }

  function draftValue(field) {
    if (field in REFERENCE_TEXT_LIMITS && editLanguage !== (draft.sourceLanguage || "en")) return draft.translations?.[editLanguage]?.[field] || "";
    return draft[field] || "";
  }

  async function translateDraft() {
    setBusy(true);
    setTranslating(true);
    setDraftError("");
    try {
      const response = await fetch("/api/admin/references/translate", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({sourceLanguage: draft.sourceLanguage || "en", targetLanguage: editLanguage,
          translation: {quote: draft.quote, role: draft.role || "", relationship: draft.relationship || ""}}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("translation.error"));
      setDraft(current => ({...current, translations: {...current.translations, [editLanguage]: data.translation}}));
      setDraftDirty(true);
    } catch (error) {
      setDraftError(error.message);
    } finally {
      setBusy(false);
      setTranslating(false);
    }
  }

  function renderDraftField(field) {
    return <TextField key={field} label={t(`fields.${field}`).replace(/ \*$/, "")}
      type={field === "date" ? "date" : field.endsWith("Url") ? "url" : "text"}
      required={field === "name"} autoFocus={field === "name"} fullWidth disabled={busy}
      value={draftValue(field)}
      slotProps={{htmlInput: {maxLength: FIELDS[field]}, inputLabel: field === "date" ? {shrink: true} : undefined}}
      onChange={(event) => updateDraft(field, event.target.value)} />;
  }

  return <div className={styles.shell}>
    <AdminHeader active="references" user={user} />
    <main className={styles.main} aria-busy={loading || busy || savingVisibility}>
      <div className={styles.toolbar}>
        <div className={styles.titleBlock}>
          <h1>{t("title")}</h1>
          <p className={styles.muted}>{t("description")}</p>
        </div>
      </div>
      <div className={styles.postWorkspace}>
        <section className={styles.postListPanel} aria-busy={savingVisibility}>
          <div className={styles.panelHeader}>
            <div className={styles.titleBlock}>
              <h2>{t("visibility.title")}</h2>
              <p className={styles.muted}>{t("visibility.description")}</p>
            </div>
          </div>
          <label className={styles.featureToggle}>
            <input
              type="checkbox"
              checked={referencesEnabled}
              disabled={loading || loadError || busy || savingVisibility}
              onChange={(event) => void saveVisibility(event.target.checked)}
            />
            <span className={styles.featureSwitch} aria-hidden="true" />
            <span className={styles.featureText}>
              <strong>{t("title")}</strong>
              <small>{t(referencesEnabled ? "visibility.visibleDescription" : "visibility.hiddenDescription")}</small>
            </span>
            <span className={styles.featureStatus}>{t(referencesEnabled ? "visibility.visible" : "visibility.hidden")}</span>
          </label>
          <p className={styles.muted}>
            {t("visibility.lastSaved", {date: updatedAt ? new Date(updatedAt).toLocaleDateString(i18n.resolvedLanguage || "en", {year: "numeric", month: "short", day: "numeric"}) : t("visibility.notSaved")})}
          </p>
        </section>
        <section className={styles.postListPanel}>
    {loadError ? <p role="alert">{t("loadError")}</p> : <form onSubmit={(event) => void save(event)}>
      <fieldset disabled={loading || busy || savingVisibility} className={local.fields}>
        <TextField select label={t("mode")} disabled={loading || busy || savingVisibility} value={references.mode}
          onChange={(event) => {setReferences({...references, mode: event.target.value}); setDirty(true);}}>
          <MenuItem value="cards">{t("cards")}</MenuItem>
          <MenuItem value="carousel">{t("carousel")}</MenuItem>
        </TextField>
        {!references.items.length && <p className={styles.muted}>{t("empty")}</p>}
        {references.items.map((item, index) => <div key={item.id} className={local.entry}>
          <div className={local.actions}>
            <h3>{item.name || t("new")}</h3>
            <Button type="button" variant="outlined" disabled={busy || savingVisibility || index === 0} onClick={() => move(index, -1)} aria-label={t("upName", {name: item.name || t("new")})}>{t("up")}</Button>
            <Button type="button" variant="outlined" disabled={busy || savingVisibility || index === references.items.length - 1} onClick={() => move(index, 1)} aria-label={t("downName", {name: item.name || t("new")})}>{t("down")}</Button>
            <Button type="button" variant="outlined" disabled={loading || busy || savingVisibility} onClick={() => {setReferences({...references, items: references.items.filter((row) => row.id !== item.id)}); setDirty(true);}}>{t("remove")}</Button>
          </div>
          <p className={styles.muted}>{[item.role, item.company].filter(Boolean).join(" · ")}</p>
          <p className={local.summary}>{item.quote}</p>
          <Button type="button" variant="outlined" disabled={loading || busy || savingVisibility} onClick={() => openEditor(item)}>{t("edit")}</Button>
        </div>)}
        <div className={local.actions}>
          <Button type="button" variant="outlined" disabled={loading || busy || savingVisibility || references.items.length >= MAX_REFERENCES} onClick={() => openEditor()}>{t("add")}</Button>
          <Button type="button" variant="outlined" disabled={loading || busy || savingVisibility} onClick={() => setPreview(!preview)} aria-expanded={preview}>{t(preview ? "hidePreview" : "preview")}</Button>
          <Button type="submit" variant="contained" disabled={loading || busy || savingVisibility || !dirty}>{t(busy ? "saving" : "save")}</Button>
          {dirty && <span className={styles.muted}>{t("unsaved")}</span>}
        </div>
      </fieldset>
    </form>}
    {preview && <ReferencesDisplay key={references.mode} references={normalizeReferences(references)} preview />}
        </section>
      </div>
    </main>
    <Dialog sx={(theme) => ({colorScheme: theme.palette.mode})} open={Boolean(draft)} fullWidth maxWidth="md" onClose={closeEditor} aria-labelledby="reference-dialog-title">
      <DialogTitle component="div" sx={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
        <Typography component="h2" variant="h6" id="reference-dialog-title">{t(references.items.some((item) => item.id === draft?.id) ? "edit" : "add")}</Typography>
        <IconButton size="small" aria-label={t("close")} disabled={busy} onClick={closeEditor}><X size={18} /></IconButton>
      </DialogTitle>
      {draft && <form onSubmit={saveDraft} className={local.dialogForm}>
        <DialogContent dividers>
          <fieldset disabled={busy} className={local.fields}>
            {draftError && <Alert severity="error">{draftError}</Alert>}
            <div className={local.grid}>
              <TextField select label={t("translation.originalLanguage")} disabled={busy} value={draft.sourceLanguage || "en"}
                onChange={(event) => {setDraft({...draft, sourceLanguage: event.target.value}); setEditLanguage(event.target.value); setDraftDirty(true);}}>
                {REFERENCE_LANGUAGES.map(code => <MenuItem key={code} value={code}>{t(`translation.${code}`)}</MenuItem>)}
              </TextField>
              <TextField select label={t("translation.editLanguage")} disabled={busy} value={editLanguage} onChange={event => setEditLanguage(event.target.value)}>
                {REFERENCE_LANGUAGES.map(code => <MenuItem key={code} value={code}>{t(`translation.${code}`)}</MenuItem>)}
              </TextField>
            </div>
            {editLanguage !== (draft.sourceLanguage || "en") && <>
              <Typography variant="body2" color="text.secondary">{t("translation.help")}</Typography>
              <Button type="button" variant="outlined" disabled={busy || !draft.quote?.trim()} onClick={() => void translateDraft()}>
                {t(translating ? "translation.working" : draft.translations?.[editLanguage]?.quote ? "translation.replace" : "translation.generate")}
              </Button>
            </>}
            <div className={outreach.contactIdentity}>
              <div className={outreach.contactPortrait}>
                <LeadPhotoEditor name={draft.name} photoUrl={draft.photoUrl} disabled={busy}
                  saveHint={t("photoSaveHint")} onChange={(url) => updateDraft("photoUrl", url)} />
              </div>
              <div className={local.grid}>
                {["name", "role", "company", "linkedinUrl"].map(renderDraftField)}
              </div>
            </div>
            <div className={local.grid}>
              {["relationship", "date"].map(renderDraftField)}
            </div>
            <TextField label={t("fields.quote").replace(/ \*$/, "")} required={editLanguage === (draft.sourceLanguage || "en")} multiline minRows={7} fullWidth disabled={busy}
              slotProps={{htmlInput: {maxLength: 10000}}} value={draftValue("quote")} onChange={(event) => updateDraft("quote", event.target.value)} />
          </fieldset>
        </DialogContent>
        <DialogActions sx={{p: 2, gap: 1}}>
          <Button type="button" variant="outlined" disabled={busy} onClick={closeEditor}>{t("cancel")}</Button>
          <Button type="submit" variant="contained" disabled={busy}>{t(busy ? "saving" : "saveReference")}</Button>
        </DialogActions>
      </form>}
    </Dialog>
  </div>;
}
