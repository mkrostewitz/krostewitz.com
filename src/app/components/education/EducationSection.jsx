'use client';
import {useEffect, useState} from 'react';
import {useTranslation} from 'react-i18next';
import pageStyles from '../../page.module.css';
import styles from './education-section.module.css';

export default function EducationSection({initialEntries = [], initialLanguage = 'en'}) {
  const {i18n} = useTranslation();
  const language = (i18n.resolvedLanguage || i18n.language || 'en').split('-')[0];
  const [content, setContent] = useState({entries: initialEntries, language: initialLanguage});
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/content/education?language=${encodeURIComponent(language)}`, {cache: 'no-store', signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error('Education unavailable');
        const data = await response.json();
        if (!controller.signal.aborted) setContent({entries: data.entries, language});
      }).catch(() => {});
    return () => controller.abort();
  }, [language]);
  const entries = content.entries;
  if (!entries.length) return null;
  const german = language === 'de';
  return <section id="education" className={pageStyles.section} aria-labelledby="education-title">
    <div className={pageStyles.sectionHeader}>
      <p className={pageStyles.eyebrow}>{german ? 'Qualifikationen' : 'Qualifications'}</p>
      <h2 id="education-title">{german ? 'Ausbildung & Weiterbildung' : 'Education & professional development'}</h2>
    </div>
    <div className={styles.grid} lang={content.language}>
      {entries.map(entry => <article key={entry.id} className={styles.card}>
        {entry.year && <p className={styles.year}>{entry.year}</p>}
        <h3>{entry.title}</h3>
        {entry.institution && <p>{entry.institution}</p>}
        {entry.detail && <p className={styles.detail}>{entry.detail}</p>}
        {entry.url && <a href={entry.url} target="_blank" rel="noopener noreferrer">{german ? 'Qualifikation ansehen (neuer Tab)' : 'View credential (new tab)'} ↗</a>}
      </article>)}
    </div>
  </section>;
}
