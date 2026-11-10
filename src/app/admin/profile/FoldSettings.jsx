"use client";

import {useEffect, useState} from 'react';
import {Alert, Button, Checkbox, FormControlLabel, Stack} from '@mui/material';
import {validateFoldContent, exportFoldContent, importFoldContent} from '../../lib/foldContent.mjs';
import {useSnackbar} from '../../components/snackbar/SnackbarProvider';
import FoldFields from './FoldFields';
import FoldTranslationDialog from './FoldTranslationDialog';
import styles from '../admin.module.css';
import formStyles from './about-settings.module.css';

import layout from "./profile-settings.module.css";

export default function FoldSettings() {
  const {showSnackbar} = useSnackbar();
  const [content, setContent] = useState(null);
  const translations = content?.translations;
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [translationOpen, setTranslationOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/fold', {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.content) throw new Error(data.error || 'Unable to load Fold / Hero.');
        setContent(data.content);
      }).catch(error => {if (!controller.signal.aborted) setError(error.message);});
    return () => controller.abort();
  }, []);

  async function save(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const validated = validateFoldContent(content);
      const response = await fetch('/api/admin/fold', {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({content: validated}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save Fold / Hero.');
      setContent(data.content);
      showSnackbar({type: 'success', message: 'Fold / Hero saved for both languages.'});
    } catch (error) {setError(error.message);}
    finally {setBusy(false);}
  }

  function download() {
    try {
      const blob = new Blob([JSON.stringify(exportFoldContent(content), null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'homepage-fold.json';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {setError(error.message);}
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      if (file.size > 200000) throw new Error('Choose a Fold export smaller than 200 KB.');
      const imported = importFoldContent(JSON.parse(await file.text()));
      setContent(current => ({...current, ...imported}));
      setError('');
      showSnackbar({type: 'success', message: 'Content imported into the editor. Review both languages, then Save Fold / Hero to publish.'});
    } catch (error) {setError(error.message);}
  }

  return <>
    <form className={formStyles.form} onSubmit={save}>
      <section className={`${styles.profilePanel} ${styles.profilePanelFull} ${layout.panel}`} aria-busy={busy}>
        <div className={styles.titleBlock}>
          <h2>Fold / Hero</h2>
          <p className={styles.muted}>The opening headline and offering text on your homepage.</p>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
        {!translations ? (!error && <p>Loading Fold / Hero…</p>) : <fieldset disabled={busy} className={formStyles.fieldset}>
          <div className={formStyles.copy}>
            <div className={layout.editorToolbar}>
              <div className={formStyles.languages} role="group" aria-label="Fold content language">
                {[['en', 'English'], ['de', 'Deutsch']].map(([value, label]) => <button key={value} type="button"
                  aria-pressed={language === value} onClick={() => setLanguage(value)}>{label}</button>)}
              </div>
              <button type="button" className={styles.button} onClick={() => setTranslationOpen(true)}>
                Translate to {language === 'en' ? 'German' : 'English'}
              </button>
            </div>
            <FormControlLabel label="Show eyebrow above the headline" control={<Checkbox disabled={busy} checked={content.showEyebrow} onChange={event => setContent(current => ({...current, showEyebrow: event.target.checked}))} />} />
            <FoldFields copy={translations[language]} language={language} disabled={busy}
              onChange={copy => setContent(current => ({...current, translations: {...current.translations, [language]: copy}}))} />
          </div>
          <div className={layout.transfer}>
            <details><summary>Content transfer & link settings</summary>
              <p>Export both languages to copy this component to another site. Imported content stays in this editor until you save.</p>
              <Stack direction="row" spacing={1} useFlexGap sx={{flexWrap: 'wrap'}}>
                <Button type="button" variant="outlined" disabled={busy} onClick={download}>Export content</Button>
                <Button component="label" variant="outlined" disabled={busy}>Import content
                  <input hidden type="file" accept="application/json,.json" onChange={upload} disabled={busy} />
                </Button>
              </Stack>
              <p>Booking follows your Koalendar settings. LinkedIn: {content.destinations?.linkedin?.url}. Imports preserve this site’s destinations.</p>
            </details>
          </div>
          <div className={formStyles.footer}>
            <p>Save changes for both languages.</p>
            <button type="submit" className={styles.button}>{busy ? 'Saving…' : 'Save Fold / Hero'}</button>
          </div>
        </fieldset>}
      </section>
    </form>
    {translationOpen && <FoldTranslationDialog source={translations[language]} sourceLanguage={language}
      onClose={() => setTranslationOpen(false)} onApply={(targetLanguage, copy) => {
        setContent(current => ({...current, translations: {...current.translations, [targetLanguage]: copy}}));
        setLanguage(targetLanguage);
        setTranslationOpen(false);
        showSnackbar({type: 'success', message: 'Translation applied. Save Fold / Hero to publish it.'});
      }} />}
  </>;
}
