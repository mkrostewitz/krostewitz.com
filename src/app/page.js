"use client";

import {useMemo} from "react";
import {useTranslation} from "react-i18next";

import styles from "./page.module.css";
import NavBar from "./components/nav/nav";
import ContactSection from "./components/contact/ContactSection";
import TimelineSection from "./components/timeline/TimelineSection";
import AboutSection from "./components/about/AboutSection";
import SkillsSection from "./components/skills/SkillsSection";
import FoldSection from "./components/fold/FoldSection";
import ExecutiveSummary from "./components/executive/ExecutiveSection";
import CvSection from "./components/cv/CvSection";

export default function Home() {
  const {t} = useTranslation();

  const skills = useMemo(
    () => [
      {
        label: t("skills.salesLabel"),
        detail: t("skills.salesDetail"),
        score: 10,
      },
      {
        label: t("skills.marketingLabel"),
        detail: t("skills.marketingDetail"),
        score: 8,
      },
      {
        label: t("skills.opsLabel"),
        detail: t("skills.opsDetail"),
        score: 9,
      },
      {
        label: t("skills.financeLabel"),
        detail: t("skills.financeDetail"),
        score: 8,
      },
      {
        label: t("skills.productLabel"),
        detail: t("skills.productDetail"),
        score: 3,
      },
      {
        label: t("skills.productionLabel"),
        detail: t("skills.productionDetail"),
        score: 4,
      },
    ],
    [t]
  );

  return (
    <div className={styles.page} id="top">
      <div className={styles.backgroundGlow} aria-hidden />
      <NavBar />
      <FoldSection />

      <main className={styles.main}>
        {/* Executive Summary & Outcomes */}
        <ExecutiveSummary skills={skills} />

        {/* Languages */}
        {/* <LanguagesSection /> */}

        {/* About Me */}
        <AboutSection />

        {/* My Skills */}
        <SkillsSection skills={skills} />

        {/* Timeline */}
        <TimelineSection />

        {/* Experience Map */}
        {/* CV Section */}
        <CvSection />

        {/* Contact Me */}
        <ContactSection />
      </main>
    </div>
  );
}
