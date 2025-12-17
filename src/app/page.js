"use client";

import {useMemo} from "react";
import {useTranslation} from "react-i18next";

import styles from "./page.module.css";
import NavBar from "./components/nav/nav";
import ExperienceMap from "./components/maps/ExpenrienceMap";
import ContactSection from "./components/contact/ContactSection";
import TimelineSection from "./components/timeline/TimelineSection";
import AboutSection from "./components/about/AboutSection";
import SkillsSection from "./components/skills/SkillsSection";
import FoldSection from "./components/fold/OfferSection";
import SummarySection from "./components/fold/FoldSection";
import LanguagesSection from "./components/languages/LanguagesSection";
import ExecutiveSummary from "./components/executive/ExecutiveSection";
import CvSection from "./components/contact/CvSection";

export default function Home() {
  const {t} = useTranslation();

  const skills = useMemo(
    () => [
      {label: t("skills.leadership"), value: 95},
      {label: t("skills.ops"), value: 93},
      {label: t("skills.product"), value: 87},
      {label: t("skills.data"), value: 92},
    ],
    [t]
  );

  const executiveSummary = t("executiveSummary", {returnObjects: true});

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden />
      <NavBar />
      <FoldSection />

      <main className={styles.main}>
        {/* Summary / Outcomes */}
        <SummarySection skills={skills} />

        {/* About Me */}
        <AboutSection />

        {/* My Skills */}
        <SkillsSection skills={skills} />

        {/* Executive Summary */}
        <ExecutiveSummary />

        {/* Timeline */}
        <TimelineSection />

        {/* Experience Map */}
        <ExperienceMap labels={t("map", {returnObjects: true})} />

        {/* CV Section */}
        <CvSection />

        {/* Languages */}
        <LanguagesSection />

        {/* Contact Me */}
        <ContactSection />
      </main>
    </div>
  );
}
