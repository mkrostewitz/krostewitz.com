"use client";

import {useEffect, useMemo, useState} from "react";
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
  const {i18n, t} = useTranslation();
  const [storedSkills, setStoredSkills] = useState(null);
  const activeLanguage = String(
    i18n.resolvedLanguage || i18n.language || FALLBACK_LANGUAGE
  ).split("-")[0];

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadSkills() {
      try {
        const response = await fetch("/api/content/skills", {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load skills.");
        }

        setStoredSkills(Array.isArray(data.skills) ? data.skills : []);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Unable to load skills", error);
        }
      }
    }

    void loadSkills();

    return () => {
      controller.abort();
    };
  }, []);

  const fallbackSkills = useMemo(
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
        score: 5,
      },
    ],
    [t],
  );
  const databaseSkills = useMemo(() => {
    if (!Array.isArray(storedSkills)) return null;

    return storedSkills
      .map((skill) => getLocalizedSkill(skill, activeLanguage))
      .filter((skill) => skill.label);
  }, [activeLanguage, storedSkills]);
  const skills = databaseSkills || fallbackSkills;

  return (
    <div className={styles.page} id="top">
      <div className={styles.backgroundGlow} aria-hidden />
      <NavBar />
      <FoldSection />

      <main className={styles.main}>
        {/* About Me */}
        <AboutSection />

        {/* Executive Summary & Outcomes */}
        <ExecutiveSummary skills={skills} />

        {/* My Skills */}
        <SkillsSection skills={skills} />

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
