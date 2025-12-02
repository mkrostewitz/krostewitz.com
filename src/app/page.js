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
import FoldSection from "./components/fold/FoldSection";
import LanguagesSection from "./components/languages/LanguagesSection";

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

  const portfolio = t("portfolio", {returnObjects: true});

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden />
      <NavBar />
      <FoldSection skills={skills} />

      <main className={styles.main}>
        <AboutSection />

        <SkillsSection skills={skills} />

        <TimelineSection />

        <section id="portfolio" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>{t("nav.portfolio")}</p>
            <h2>{t("nav.portfolio")}</h2>
          </div>
          <div className={styles.cards}>
            {portfolio.map((item) => (
              <article key={item.title} className={styles.card}>
                <div className={styles.cardMeta}>{item.role}</div>
                <h3>{item.title}</h3>
                <p>{item.impact}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="map" className={styles.section}>
          <div className={styles.sectionHeader}>
            <p className={styles.eyebrow}>{t("map.title")}</p>
            <h2>{t("map.title")}</h2>
          </div>
          <ExperienceMap labels={t("map", {returnObjects: true})} />
        </section>

        <LanguagesSection />

        <ContactSection />
      </main>
    </div>
  );
}
