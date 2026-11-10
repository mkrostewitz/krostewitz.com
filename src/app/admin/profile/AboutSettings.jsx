"use client";

/* eslint-disable @next/next/no-img-element */
import {useEffect, useState} from "react";
import PhotoEditor from "../components/forms/PhotoEditor";
import AboutTranslationDialog from "./AboutTranslationDialog";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import styles from "../admin.module.css";
import aboutStyles from "./about-settings.module.css";

export default function AboutSettings() {
  const {showSnackbar} = useSnackbar();
  const [about, setAbout] = useState(null);
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [translationOpen, setTranslationOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/profile", {cache: "no-store", signal: controller.signal})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.profile?.about) throw new Error(data.error || "Unable to load About settings.");
        setAbout(data.profile.about);
      })
      .catch(error => {if (!controller.signal.aborted) setLoadError(error.message);});
    return () => controller.abort();
  }, []);

  async function persist(nextAbout) {
    const response = await fetch("/api/admin/profile", {
      method: "PUT", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({about: nextAbout}),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to save About settings.");
    setAbout(data.profile.about);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      await persist(about);
      showSnackbar({type: "success", message: "About saved."});
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {setBusy(false);}
  }

  async function changePhoto(photoUrl) {
    setBusy(true);
    try {
      await persist({...about, photoUrl});
      showSnackbar({type: "success", message: photoUrl ? "Photo and About saved." : "Photo removed and About saved."});
    } finally {setBusy(false);}
  }

  function changeCopy(field, value) {
    setAbout(current => ({...current, translations: {...current.translations,
      [language]: {...current.translations[language], [field]: value},
    }}));
  }

  const copy = about?.translations?.[language];
  return (
    <form className={aboutStyles.form} onSubmit={save}>
      <section className={`${styles.profilePanel} ${styles.profilePanelFull}`} aria-busy={busy}>
        <div className={styles.titleBlock}>
          <h2>About</h2>
          <p className={styles.muted}>Your introduction, career highlights, and portrait.</p>
        </div>
        {loadError ? <p role="alert">{loadError}</p> : !about ? <p>Loading About…</p> : (
          <fieldset disabled={busy} className={aboutStyles.fieldset}>
            <div className={aboutStyles.layout}>
              <div className={aboutStyles.copy}>
                <div className={aboutStyles.copyHeader}>
                  <h3>Introduction</h3>
                  <div className={aboutStyles.languages} role="group" aria-label="Content language">
                    {[["en", "English"], ["de", "Deutsch"]].map(([value, label]) => (
                      <button key={value} type="button" aria-pressed={language === value}
                        onClick={() => setLanguage(value)}>{label}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <button type="button" className={styles.button} disabled={!copy.headline.trim() || !copy.body.trim()}
                    onClick={() => setTranslationOpen(true)}>
                    Translate to {language === "en" ? "German" : "English"}
                  </button>
                </div>
                <label className={styles.field}>Headline
                  <textarea required rows={2} maxLength={500} className={aboutStyles.headline}
                    value={copy.headline} onChange={event => changeCopy("headline", event.target.value)} />
                </label>
                <label className={styles.field}>About text
                  <textarea required rows={12} maxLength={20000} lang={language}
                    value={copy.body.replace(/<br\s*\/?\s*>/gi, "\n")}
                    onChange={event => changeCopy("body", event.target.value.replace(/\n/g, "<br/>"))} />
                  <small className={styles.muted}>Separate paragraphs with a blank line.</small>
                </label>
                <label className={styles.field}>Career highlights
                  <textarea rows={7} lang={language} value={copy.highlights.join("\n")}
                    onChange={event => changeCopy("highlights", event.target.value.split("\n"))} />
                  <small className={styles.muted}>One highlight per line.</small>
                </label>
              </div>
              <aside className={aboutStyles.sidebar}>
                <section className={aboutStyles.photoPanel} aria-labelledby="about-photo-heading">
                  <div className={aboutStyles.sectionHeading}>
                    <h3 id="about-photo-heading">Portrait</h3>
                    <p>Shared across both languages.</p>
                  </div>
                  <PhotoEditor photoUrl={about.photoUrl} onChange={changePhoto} disabled={busy}
                    label="About portrait" purpose="about-photo" aspectRatio={4 / 5} circular={false}
                    saveHint="Applying or removing the photo also saves your current text edits."
                    preview={about.photoUrl ? <img src={about.photoUrl} alt={about.photoAlt || "Current About portrait"}
                      className={aboutStyles.portrait} /> : <span className={aboutStyles.emptyPortrait}>Add portrait</span>} />
                  <label className={styles.field}>Photo description
                    <input maxLength={200} placeholder="Describe the portrait" value={about.photoAlt}
                      onChange={event => setAbout(current => ({...current, photoAlt: event.target.value}))} />
                    <small className={styles.muted}>Used by screen readers.</small>
                  </label>
                  <p className={aboutStyles.note}>Changing the photo also saves your current text edits.</p>
                </section>
                <section className={aboutStyles.context}>
                  <h3>At a glance</h3>
                  <p>This summary is built from your profile. Update it in:</p>
                  <a href="/admin/cv">CV experience <span aria-hidden="true">↗</span></a>
                  <a href="/admin/skills">Skills <span aria-hidden="true">↗</span></a>
                  <a href="/admin/education">Education & languages <span aria-hidden="true">↗</span></a>
                </section>
              </aside>
            </div>
            <div className={aboutStyles.footer}>
              <p>Save changes for both languages.</p>
              <button className={styles.button} type="submit">{busy ? "Saving…" : "Save About"}</button>
            </div>
          </fieldset>
        )}
      </section>
      {translationOpen && <AboutTranslationDialog source={copy} sourceLanguage={language}
        onClose={() => setTranslationOpen(false)}
        onApply={(targetLanguage, translation) => {
          setAbout(current => ({...current, translations: {...current.translations, [targetLanguage]: translation}}));
          setLanguage(targetLanguage);
          setTranslationOpen(false);
          showSnackbar({type: "success", message: "Translation applied. Save About to publish it."});
        }} />}
    </form>
  );
}
