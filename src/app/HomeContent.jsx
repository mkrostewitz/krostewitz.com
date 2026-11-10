"use client";

import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import {FALLBACK_LANGUAGE} from "@/lib/languageDetection";
import {loadRuntimeTranslations} from "../lib/i18n";
import styles from "./page.module.css";
import NavBar from "./components/nav/nav";
import ContactSection from "./components/contact/ContactSection";
import EducationSection from "./components/education/EducationSection";
import TimelineSection from "./components/timeline/TimelineSection";
import AboutSection from "./components/about/AboutSection";
import ReferencesSection from "./components/references/ReferencesSection";
import PersonalSection from "./components/personal/PersonalSection";
import SkillsSection from "./components/skills/SkillsSection";
import FoldSection from "./components/fold/FoldSection";
import ExecutiveSummary from "./components/executive/ExecutiveSection";
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

export default function HomeContent({initialSummary = null, initialFold}) {
  const {i18n} = useTranslation();
  const {
    labEnabled,
    personalEnabled,
    skills: storedSkills,
    skillsAvailable,
    skillsEnabled,
  } = usePublicSettings();
  const activeLanguage = String(
    i18n.resolvedLanguage || i18n.language || FALLBACK_LANGUAGE
  ).split("-")[0];

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  const [summary, setSummary] = useState(initialSummary);
  const [summaryError, setSummaryError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/content/executive-summary?language=${encodeURIComponent(activeLanguage)}`, {cache: "no-store", signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error("Summary unavailable");
        setSummary({...await response.json(), language: activeLanguage});
        setSummaryError(false);
      }).catch(() => {if (!controller.signal.aborted) setSummaryError(true);});
    return () => controller.abort();
  }, [activeLanguage]);
  const activeSummary = summary?.language === activeLanguage ? summary : null;

  const databaseSkills = useMemo(() => {
    if (!skillsAvailable || !Array.isArray(storedSkills)) return [];

    return storedSkills
      .map((skill) => getLocalizedSkill(skill, activeLanguage))
      .filter((skill) => skill.label)
      .map(skill => {
        const usage = activeSummary?.skillUsage?.find(item => item.id === skill.id);
        return {...skill, usage: usage || null, score: usage ? usage.percentage / 10 : null};
      });
  }, [activeLanguage, skillsAvailable, storedSkills, activeSummary]);
  const showSkillsSection = skillsEnabled === true && (databaseSkills.length > 0 || Boolean(activeSummary?.industries?.length));

  return (
    <div className={styles.page} id="top">
      <div className={styles.backgroundGlow} aria-hidden />
      <NavBar />
      <FoldSection content={initialFold} />

      <main className={styles.main}>
        {/* About Me */}
        <AboutSection />

        {/* Executive Summary & Outcomes */}
        <ExecutiveSummary skills={databaseSkills} summary={activeSummary} loadError={summaryError} />

        {/* My Skills */}
        {showSkillsSection ? <SkillsSection initialCountry={activeSummary?.mapInitialCountry} countries={activeSummary?.countries} skills={databaseSkills} industries={activeSummary?.industries || []} loadError={summaryError} /> : null}

        {/* Experience and CV */}
        <TimelineSection />

        <EducationSection initialEntries={initialSummary?.education || []} />

        <ReferencesSection />

        {/* Blog */}
        <BlogSection />

        {/* Portfolio */}
        {labEnabled === true ? <PortfolioSection /> : null}

        {/* Personal */}
        {personalEnabled === true ? <PersonalSection /> : null}

        {/* Contact Me */}
        <ContactSection />
      </main>
      <PublicFooter />
    </div>
  );
}
