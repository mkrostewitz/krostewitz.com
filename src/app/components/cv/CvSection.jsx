"use client";

import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import "../../buttons.css";

const DEFAULT_CV_DOWNLOADS = {
  en: {
    url: "/data/CV_Mathias_Krostewitz_EN.pdf",
    fileName: "Mathias_Krostewitz_CV_EN.pdf",
  },
  de: {
    url: "/data/CV_Mathias_Krostewitz_DE.pdf",
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

  useEffect(() => {
    let cancelled = false;

    async function loadDownloads() {
      try {
        const response = await fetch("/api/cv", {cache: "no-store"});
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

  const cvDownload = useMemo(() => {
    const language = normalizeLanguage(i18n.language);
    return downloads[language] || downloads.en || DEFAULT_CV_DOWNLOADS.en;
  }, [downloads, i18n.language]);

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
      <a
        href={cvDownload.url}
        download={cvDownload.fileName || true}
        className="primary"
      >
        {t("cv.download")}
      </a>
    </section>
  );
};

export default CvSection;
