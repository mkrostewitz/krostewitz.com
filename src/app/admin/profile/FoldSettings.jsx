"use client";

import {useEffect, useState} from 'react';
import {Alert} from '@mui/material';
import {validateFoldTranslations} from '../../lib/foldContent.mjs';
import {loadRuntimeTranslations} from '../../../lib/i18n';
import {useSnackbar} from '../../components/snackbar/SnackbarProvider';
import FoldFields from './FoldFields';
import FoldTranslationDialog from './FoldTranslationDialog';
import styles from '../admin.module.css';
import formStyles from './about-settings.module.css';

export default function FoldSettings() {
  const {showSnackbar} = useSnackbar();
  const [translations, setTranslations] = useState(null);
  const [language, setLanguage] = useState('en');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [translationOpen, setTranslationOpen] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/admin/fold', {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        const data = await response.json();
        if (!response.ok || !data.translations) throw new Error(data.error || 'Unable to load Fold / Hero.');
        setTranslations(data.translations);
      }).catch(error => {if (!controller.signal.aborted) setError(error.message);});
    return () => controller.abort();
  }, []);

  async function save(event) {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const validated = validateFoldTranslations(translations);
      const response = await fetch('/api/admin/fold', {
        method: 'PUT', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({translations: validated}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save Fold / Hero.');
      setTranslations(data.translations);
      await loadRuntimeTranslations();
      showSnackbar({type: 'success', message: 'Fold / Hero saved for both languages.'});
    } catch (error) {setError(error.message);}
    finally {setBusy(false);}
  }

  return <>
    <form className={formStyles.form} onSubmit={save}>
      <section className={`${styles.profilePanel} ${styles.profilePanelFull}`} aria-busy={busy}>
        <div className={styles.titleBlock}>
          <h2>Fold / Hero</h2>
          <p className={styles.muted}>The opening headline and offering text on your homepage.</p>
        </div>
        {error && <Alert severity="error">{error}</Alert>}
        {!translations ? (!error && <p>Loading Fold / Hero…</p>) : <fieldset disabled={busy} className={formStyles.fieldset}>
          <div className={formStyles.copy}>
            <div className={formStyles.copyHeader}>
              <div className={formStyles.languages} role="group" aria-label="Fold content language">
                {[['en', 'English'], ['de', 'Deutsch']].map(([value, label]) => <button key={value} type="button"
                  aria-pressed={language === value} onClick={() => setLanguage(value)}>{label}</button>)}
              </div>
              <button type="button" className={styles.button} onClick={() => setTranslationOpen(true)}>
                Translate to {language === 'en' ? 'German' : 'English'}
              </button>
            </div>
            <FoldFields copy={translations[language]} language={language} disabled={busy}
              onChange={copy => setTranslations(current => ({...current, [language]: copy}))} />
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
        setTranslations(current => ({...current, [targetLanguage]: copy}));
        setLanguage(targetLanguage);
        setTranslationOpen(false);
        showSnackbar({type: 'success', message: 'Translation applied. Save Fold / Hero to publish it.'});
      }} />}
  </>;
}
