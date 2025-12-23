"use client";

import {useMemo} from "react";
import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./cv-section.module.css";

const CvSection = () => {
  const {t, i18n} = useTranslation();

  const cvPath = useMemo(
    () =>
      `/data/CV_Mathias_Krostewitz_${i18n.language
        .split("-")[0]
        .toUpperCase()}.pdf`,
    [i18n.language]
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
      <a
        href={cvPath}
        download
        className={`${pageStyles.primary} ${styles.cvButton}`}
      >
        {t("cv.download")}
      </a>
    </section>
  );
};

export default CvSection;
