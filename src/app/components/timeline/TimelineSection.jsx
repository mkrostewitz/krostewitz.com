import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import {useInViewOnce} from "@/lib/useInViewOnce";
import pageStyles from "../../page.module.css";
import styles from "./timeline-section.module.css";

const TimelineSection = () => {
  const {t} = useTranslation();
  const [sectionRef, inView] = useInViewOnce({threshold: 0.15});
  const [selectedIndex, setSelectedIndex] = useState(null);
  const timeline = t("timeline", {returnObjects: true});
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

  const closeDialog = () => setSelectedIndex(null);
  const openItemOnKeyDown = (event, idx) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelectedIndex(idx);
    }
  };

  return (
    <section id="timeline" className={pageStyles.section} ref={sectionRef}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.timeline")}</p>
        <h2>{t("nav.timeline")}</h2>
      </div>
      <div className={styles.timeline}>
        {timeline.map((item, idx) => (
          <div
            key={item.title}
            className={`${styles.timelineItem} ${
              inView ? styles.timelineItemVisible : ""
            }`}
            style={{"--item-delay": `${idx * 120}ms`}}
            onClick={() => setSelectedIndex(idx)}
            onKeyDown={(event) => openItemOnKeyDown(event, idx)}
            role="button"
            tabIndex={0}
            aria-label={t("timelineDialog.open", {title: item.title})}
          >
            <div className={styles.timelineBadge}>{item.period}</div>
            <span className={styles.timelineMarker} aria-hidden="true" />
            <div className={styles.timelineBody}>
              <h3>{item.title}</h3>
              <p className={styles.location}>{item.location}</p>
              <p>{item.detail}</p>
              <span className={styles.timelineAction}>
                {t("timelineDialog.viewDetails")}
              </span>
            </div>
          </div>
        ))}
      </div>

      {selectedItem && (
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

            <p id="timeline-dialog-summary" className={styles.modalSummary}>
              {selectedItem.detail}
            </p>

            {selectedHighlights.length > 0 && (
              <div className={styles.modalHighlights}>
                <h4>{t("timelineDialog.highlights")}</h4>
                <ul>
                  {selectedHighlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
              </div>
            )}
          </article>
        </div>
      )}
    </section>
  );
};

export default TimelineSection;
