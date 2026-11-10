import {sanitizeTimelineHtml, timelineHtmlText} from "../../lib/timelineRichText.mjs";
import {FileText, ArrowUpRight, ChevronDown, ChevronUp} from "lucide-react";
import {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {useTranslation} from "react-i18next";

import {groupTimelineRoles} from "../../lib/timelineGroups.mjs";
import {localizeTimeline} from "../../lib/cvTimelineData.mjs";
import {useInViewOnce} from "@/lib/useInViewOnce";
import CvSection from "../cv/CvSection";
import pageStyles from "../../page.module.css";
import styles from "./timeline-section.module.css";

function DocumentLinks({documents, t}) {
  if (!documents?.length) return null;
  return <div className={styles.documentPanel}>
    <h4>{t("timelineDialog.documents")}</h4>
    <ul className={styles.documentLinks}>
      {documents.map(doc => <li key={doc.id}>
        <a href={doc.url} target="_blank" rel="noopener noreferrer" onClick={event => event.stopPropagation()}>
          <span className={styles.documentIcon}><FileText size={22} aria-hidden="true" /></span>
          <span className={styles.documentTitle}>{doc.title.replace(/_/g, " ").replace(/\.pdf$/i, "")}<small>PDF{doc.language ? ` · ${t(`timelineDialog.documentLanguages.${doc.language}`)}` : ""}</small></span>
          <ArrowUpRight className={styles.documentArrow} size={18} aria-hidden="true" />
          <span className={styles.srOnly}>{t("timelineDialog.opensNewTab")}</span>
        </a>
      </li>)}
    </ul>
  </div>;
}

const TimelineSection = () => {
  const {t, i18n} = useTranslation();
  const [sectionRef, inView] = useInViewOnce({threshold: 0.15});
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState(null);
  const fallback = t("timeline", {returnObjects: true});
  const timeline = entries === null
    ? (Array.isArray(fallback) ? fallback : [])
    : localizeTimeline(entries, (i18n.resolvedLanguage || i18n.language || "en").split("-")[0]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/content/cv-timeline", {cache: "no-store", signal: controller.signal})
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (Array.isArray(data?.entries)) {
          setSelectedIndex(null);
          setEntries(data.entries);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const selectedItem =
    Number.isInteger(selectedIndex) && Array.isArray(timeline)
      ? timeline[selectedIndex]
      : null;
  const selectedHighlights = Array.isArray(selectedItem?.highlights)
    ? selectedItem.highlights
    : [];

  useEffect(() => {
    if (selectedIndex === null) return undefined;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") {
        setSelectedIndex(null);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [selectedIndex]);

  const hiddenCount = timeline.filter(item => item.showAfterMore).length;
  const closeDialog = () => setSelectedIndex(null);

  return (
    <section id="timeline" className={pageStyles.section} ref={sectionRef}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.timeline")}</p>
        <h2>{t("nav.timeline")}</h2>
      </div>
      <div id="timeline-entries" className={styles.timeline}>
        {groupTimelineRoles(timeline, expanded).map(group => (
          <div key={group.roles[0].item.id || group.roles[0].index} className={group.label && group.roles.length > 1 ? styles.employerGroup : styles.ungrouped}>
            {group.label && group.roles.length > 1 && <header className={styles.employerHeader}>
              <h3>{group.label}</h3><span>{t("timelineDialog.positions", {count: group.roles.length})}</span>
            </header>}
            {group.roles.map(({item, index: idx}) => (
          <div
            key={item.id || item.title}
            className={`${styles.timelineItem} ${
              inView ? styles.timelineItemVisible : ""
            }`}
            style={{"--item-delay": `${idx * 120}ms`}}
            onClick={() => setSelectedIndex(idx)}
          >
            <div className={styles.timelineBadge}>{item.period}</div>
            <span className={styles.timelineMarker} aria-hidden="true" />
            <div className={styles.timelineBody}>
              <h3>{item.title}</h3>
              {item.company && <p className={styles.company}>{item.company}</p>}
              <p className={styles.location}>{item.location}</p>
              <p>{item.detail}</p>
              <DocumentLinks documents={item.documents} t={t} />
              <button type="button" className={styles.timelineAction} aria-label={t("timelineDialog.open", {title: item.title})} onClick={event => {event.stopPropagation(); setSelectedIndex(idx);}}>
                {t("timelineDialog.viewDetails")}
              </button>
            </div>
          </div>
            ))}
          </div>
        ))}
      </div>

      {hiddenCount > 0 && <div className={styles.expandRow}>
        <button type="button" className={styles.expandButton} aria-expanded={expanded} aria-controls="timeline-entries" onClick={() => {setSelectedIndex(null); setExpanded(value => !value);}}>
          {t(expanded ? "timelineDialog.showLess" : "timelineDialog.showMore", {count: hiddenCount})}
          {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
      </div>}

      <CvSection />

      {selectedItem && createPortal(
        <div
          className={styles.modalBackdrop}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeDialog();
            }
          }}
        >
          <article
            className={styles.modal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="timeline-dialog-title"
            aria-describedby="timeline-dialog-summary"
          >
            <header className={styles.modalHeader}>
              <div>
                <p className={styles.modalPeriod}>{selectedItem.period}</p>
                <h3 id="timeline-dialog-title">{selectedItem.title}</h3>
                {selectedItem.company && <p className={styles.company}>{selectedItem.company}</p>}
                <p className={styles.modalLocation}>{selectedItem.location}</p>
              </div>
              <button
                type="button"
                className={styles.closeButton}
                onClick={closeDialog}
              >
                {t("timelineDialog.close")}
              </button>
            </header>
            <DocumentLinks documents={selectedItem.documents} t={t} />

            {selectedItem.detailHtml !== undefined ? <div id="timeline-dialog-summary" className={`${styles.modalSummary} ${styles.richText}`} dangerouslySetInnerHTML={{__html: sanitizeTimelineHtml(selectedItem.detailHtml)}} /> : <p id="timeline-dialog-summary" className={styles.modalSummary}>{selectedItem.detail}</p>}

            {(selectedItem.highlightsHtml !== undefined ? Boolean(timelineHtmlText(selectedItem.highlightsHtml)) : selectedHighlights.length > 0) && (
              <div className={styles.modalHighlights}>
                <h4>{t("timelineDialog.highlights")}</h4>
                {selectedItem.highlightsHtml !== undefined ? <div className={styles.richText} dangerouslySetInnerHTML={{__html: sanitizeTimelineHtml(selectedItem.highlightsHtml)}} /> : <ul>
                  {selectedHighlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>}
              </div>
            )}

          </article>
        </div>,
        document.body
      )}
    </section>
  );
};

export default TimelineSection;
