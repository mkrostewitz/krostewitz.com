"use client";

import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import LeadCaptureModal from "../contact/LeadCaptureModal";
import pageStyles from "../../page.module.css";
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
      className={pageStyles.section}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <div className={pageStyles.sectionHeader}>
        <h2>{t("cv.title")}</h2>
        <p className={pageStyles.lead}>{t("cv.subtitle")}</p>
      </div>
      <button
        type="button"
        className="primary"
        title={cvDownload.fileName || t("cv.download")}
        onClick={() => setIsModalOpen(true)}
      >
        {t("cv.download")}
      </button>
      <LeadCaptureModal
        cvLanguage={language}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onVerified={(data) => {
          if (data.downloadUrl) {
            window.location.assign(data.downloadUrl);
          }
        }}
        sourceType="cv_download"
      />
    </section>
  );
};

export default CvSection;
