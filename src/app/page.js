"use client";

import {useEffect, useMemo} from "react";
import {useTranslation} from "react-i18next";

import {FALLBACK_LANGUAGE} from "@/lib/languageDetection";
import {loadRuntimeTranslations} from "../lib/i18n";
import styles from "./page.module.css";
import NavBar from "./components/nav/nav";
import ContactSection from "./components/contact/ContactSection";
import TimelineSection from "./components/timeline/TimelineSection";
import AboutSection from "./components/about/AboutSection";
import PersonalSection from "./components/personal/PersonalSection";
import SkillsSection from "./components/skills/SkillsSection";
import FoldSection from "./components/fold/FoldSection";
import ExecutiveSummary from "./components/executive/ExecutiveSection";
import CvSection from "./components/cv/CvSection";
import BlogSection from "./components/blog/BlogSection";
import PortfolioSection from "./components/portfolio/PortfolioSection";
import PublicFooter from "./components/footer/PublicFooter";
import {usePublicSettings} from "./components/public-settings/PublicSettingsProvider";

function getLocalizedSkill(skill, language) {
  const translations =
    skill?.translations &&
    typeof skill.translations === "object" &&
    !Array.isArray(skill.translations)
      ? skill.translations
      : {};
  const requested = translations[language] || {};
  const fallback = translations[FALLBACK_LANGUAGE] || {};
  const firstTranslation =
    Object.values(translations).find((translation) => translation?.label) || {};
  const label =
    requested.label ||
    fallback.label ||
    firstTranslation.label ||
    skill?.label ||
    "";
  const detail =
    requested.detail ||
    fallback.detail ||
    firstTranslation.detail ||
    skill?.detail ||
    "";

  return {
    id: skill?.id || label,
    label,
    detail,
    score: skill?.score,
  };
}

export default function Home() {
  const {i18n} = useTranslation();
  const {
    skills: storedSkills,
    skillsAvailable,
  } = usePublicSettings();
  const activeLanguage = String(
    i18n.resolvedLanguage || i18n.language || FALLBACK_LANGUAGE
  ).split("-")[0];

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  const databaseSkills = useMemo(() => {
    if (!skillsAvailable || !Array.isArray(storedSkills)) return [];

    return storedSkills
      .map((skill) => getLocalizedSkill(skill, activeLanguage))
      .filter((skill) => skill.label);
  }, [activeLanguage, skillsAvailable, storedSkills]);
  const showSkillsSection = skillsAvailable && databaseSkills.length > 0;

  return (
    <div className={styles.page} id="top">
      <div className={styles.backgroundGlow} aria-hidden />
      <NavBar />
      <FoldSection />

      <main className={styles.main}>
        {/* About Me */}
        <AboutSection />

        {/* Executive Summary & Outcomes */}
        <ExecutiveSummary skills={databaseSkills} />

        {/* My Skills */}
        {showSkillsSection ? <SkillsSection skills={databaseSkills} /> : null}

        {/* Timeline */}
        <TimelineSection />

        {/* Experience Map */}
        {/* CV Section */}
        <CvSection />

        {/* Blog */}
        <BlogSection />

        {/* Portfolio */}
        <PortfolioSection />

        {/* Personal */}
        <PersonalSection />

        {/* Contact Me */}
        <ContactSection />
      </main>
      <PublicFooter />
    </div>
  );
}
