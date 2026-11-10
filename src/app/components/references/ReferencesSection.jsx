"use client";

/* eslint-disable @next/next/no-img-element */
import {localizeReference, referencePresentation} from "../../lib/references.mjs";
import {Dialog, DialogTitle, DialogContent, IconButton, Typography} from "@mui/material";
import {X} from "lucide-react";
import AdminMuiProvider from "../../admin/components/forms/AdminMuiProvider";
import {useEffect, useId, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {usePublicSettings} from "../public-settings/PublicSettingsProvider";
import pageStyles from "../../page.module.css";
import styles from "./references.module.css";

function excerpt(quote) {
  const text = quote.replace(/\s+/g, " ").trim();
  if (text.length <= 280) return text;
  const shortened = text.slice(0, 280);
  const boundary = shortened.lastIndexOf(" ");
  return `${shortened.slice(0, boundary > 200 ? boundary : 280)}…`;
}

function ReferenceCard({item, t, language, full = false, onMore}) {
  const [failedPhoto, setFailedPhoto] = useState(false);
  return (
    <article className={`${styles.card} ${full ? styles.fullCard : styles.compactCard}`}>
      <div className={styles.person}>
        {item.photoUrl && !failedPhoto ? (
          <img src={item.photoUrl} alt="" width={64} height={64} loading="lazy" onError={() => setFailedPhoto(true)} />
        ) : (
          <span className={styles.avatar} aria-hidden="true">{item.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span>
        )}
        <div>
          <h3>{item.name}</h3>
          {item.role && <p>{item.role}</p>}
          {item.company && <p className={styles.company}>{item.company}</p>}
        </div>
      </div>
      <blockquote className={full ? undefined : styles.excerpt}>{full ? item.quote : excerpt(item.quote)}</blockquote>
      {!full && <button type="button" className={styles.more} onClick={() => onMore(item.id)} aria-label={t("moreAbout", {name: item.name})}>{t("more")}</button>}
      {(item.relationship || item.date) && <p className={styles.context}>
        {item.date && <time dateTime={item.date}>{new Date(`${item.date}T12:00:00Z`).toLocaleDateString(language, {year: "numeric", month: "long", day: "numeric", timeZone: "UTC"})}</time>}
        {item.date && item.relationship ? " · " : ""}{item.relationship}
      </p>}
      {item.linkedinUrl && <a href={item.linkedinUrl} target="_blank" rel="noopener noreferrer">{t("linkedin", {name: item.name})} ↗</a>}
    </article>
  );
}

export function ReferencesDisplay({references, preview = false}) {
  const {t, i18n} = useTranslation(undefined, {keyPrefix: "references"});
  const titleId = useId();
  const [activeId, setActiveId] = useState(null);
  const [paused, setPaused] = useState(false);
  const viewportRef = useRef(null);
  const carousel = references.mode === "carousel" && references.items.length > 1;
  const items = references.items.map((item) => referencePresentation(localizeReference(item, i18n.resolvedLanguage || i18n.language)));
  const activeItem = items.find(item => item.id === activeId);
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!carousel || paused || activeId || !viewport) return;
    const timer = window.setInterval(() => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
          viewport.matches(":hover, :focus-within")) return;
      const cards = [...viewport.querySelectorAll("article")];
      const left = viewport.getBoundingClientRect().left;
      const next = cards.find(card => card.getBoundingClientRect().left > left + 2);
      const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
      viewport.scrollTo({left: atEnd || !next ? 0 : viewport.scrollLeft + next.getBoundingClientRect().left - left, behavior: "smooth"});
    }, 18000);
    return () => window.clearInterval(timer);
  }, [carousel, paused, activeId]);
  if (!items.length) return null;
  return (
    <section id={preview ? undefined : "references"} className={pageStyles.section} aria-label={t("title")}>
      <div className={styles.heading}>
        <div className={pageStyles.sectionHeader}>
          <p className={pageStyles.eyebrow}>{t("eyebrow")}</p>
          <h2>{t("title")}</h2>
          <p className={pageStyles.lead}>{t("subtitle")}</p>
        </div>
        {carousel && <button type="button" className={styles.pause} aria-pressed={paused} onClick={() => setPaused(!paused)}>{t(paused ? "resume" : "pause")}</button>}
      </div>
      <div ref={viewportRef} className={carousel ? styles.viewport : undefined} tabIndex={carousel ? 0 : undefined} aria-label={carousel ? t("carousel") : undefined}>
        <div className={carousel ? styles.group : styles.gridItems}>
          {items.map((item) => <ReferenceCard key={`${item.id}-${item.photoUrl}`} item={item} t={t} language={i18n.resolvedLanguage || "en"} onMore={setActiveId} />)}
        </div>
      </div>
      <AdminMuiProvider>
        <Dialog open={Boolean(activeItem)} onClose={() => setActiveId(null)} maxWidth="sm" fullWidth aria-labelledby={titleId}
          sx={theme => ({colorScheme: theme.palette.mode})}>
          <DialogTitle id={`${titleId}-bar`} component="div" sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2}}>
            <Typography id={titleId} component="h2" variant="h6">{t("recommendation")}</Typography>
            <IconButton size="small" aria-label={t("close")} onClick={() => setActiveId(null)}><X size={20} /></IconButton>
          </DialogTitle>
          <DialogContent dividers>
            {activeItem && <ReferenceCard item={activeItem} t={t} language={i18n.resolvedLanguage || "en"} full />}
          </DialogContent>
        </Dialog>
      </AdminMuiProvider>
    </section>
  );
}

export default function ReferencesSection() {
  const {profile, referencesAvailable} = usePublicSettings();
  return referencesAvailable ? <ReferencesDisplay references={profile.references} /> : null;
}
