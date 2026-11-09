"use client";

import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import LeadCaptureModal from "../contact/LeadCaptureModal";
import pageStyles from "../../page.module.css";
import styles from "./cv-section.module.css";
import "../../buttons.css";

const DEFAULT_CV_DOWNLOADS = {
  en: {
    fileName: "Mathias_Krostewitz_CV_EN.pdf",
  },
  de: {
    fileName: "Mathias_Krostewitz_CV_DE.pdf",
  },
};

function normalizeLanguage(language) {
  const code = String(language || "en")
    .split("-")[0]
    .toLowerCase();

  return DEFAULT_CV_DOWNLOADS[code] ? code : "en";
}

const CvSection = () => {
  const {t, i18n} = useTranslation();
  const [downloads, setDownloads] = useState(DEFAULT_CV_DOWNLOADS);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDownloads() {
      try {
        const response = await fetch("/api/cv");
        const data = await response.json().catch(() => ({}));

        if (!response.ok || cancelled) return;

        setDownloads({
          ...DEFAULT_CV_DOWNLOADS,
          ...(data.downloads || {}),
        });
      } catch {
        // Keep the bundled PDFs available when runtime settings are unreachable.
      }
    }

    loadDownloads();

    return () => {
      cancelled = true;
    };
  }, []);

  const language = normalizeLanguage(i18n.language);
  const cvDownload = useMemo(
    () => downloads[language] || downloads.en || DEFAULT_CV_DOWNLOADS.en,
    [downloads, language]
  );

  return (
    <section
      id="cv"
      className={styles.cvDownload}
      aria-labelledby="cv-title"
    >
      <div className={pageStyles.sectionHeader}>
        <h3 id="cv-title" className={styles.title}>{t("cv.title")}</h3>
        <p className={pageStyles.lead}>{t("cv.subtitle")}</p>
      </div>
      <button
        type="button"
        className={`primary ${styles.cvButton}`}
        title={cvDownload.fileName || t("cv.download")}
        onClick={() => setIsModalOpen(true)}
      >
        {t("cv.download")}
      </button>
      <LeadCaptureModal
        cvDownloads={downloads}
        cvLanguage={language}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        sourceType="cv_download"
      />
    </section>
  );
};

export default CvSection;
