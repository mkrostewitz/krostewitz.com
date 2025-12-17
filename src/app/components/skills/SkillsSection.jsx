import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./skills-section.module.css";

const SkillsSection = ({skills}) => {
  const {t} = useTranslation();

  const levelForScore = (score) => {
    if (score <= 4) return "support";
    if (score <= 8) return "lead";
    return "own";
  };

  return (
    <section id="skills" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("skills.title")}</p>
        <h2>{t("skills.headline")}</h2>
        <p className={pageStyles.lead}>{t("skills.description")}</p>
      </div>
      <div className={styles.skills}>
        {skills.map((skill) => {
          const level = levelForScore(skill.score || 0);
          const width = `${Math.min(Math.max(skill.score, 0), 10) * 10}%`;
          return (
            <div key={skill.label} className={styles.skill}>
              <div className={styles.skillTop}>
                <div>
                  <span className={styles.label}>{skill.label}</span>
                  {skill.detail && (
                    <p className={styles.detail}>{skill.detail}</p>
                  )}
                </div>
                {/* <span className={styles.level}>
                  {t(`skills.levels.${level}`)}
                </span> */}
              </div>
              <div className={styles.skillBar}>
                <div
                  className={styles.skillFill}
                  data-label={t(`skills.levels.${level}`)}
                  style={{width}}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span>{t("skills.levels.support")}</span>
        <span>{t("skills.levels.lead")}</span>
        <span>{t("skills.levels.own")}</span>
      </div>

      <div className={styles.flashcardsHeader}>
        <h2>{t("skills.industriesTitle")}</h2>
      </div>

      <div className={styles.flashcards}>
        {[
          {
            icon: "🏭",
            title: "Industrial Manufacturing",
            detail: "Factory / discrete manufacturing environments",
          },
          {
            icon: "⚙️",
            title: "Automation & Controls",
            detail: "Industrial components and systems suppliers",
          },
          {
            icon: "📦",
            title: "Wholesale / Distribution",
            detail: "B2B technical and industrial distribution",
          },
          {
            icon: "🚉",
            title: "Transportation & Infrastructure",
            detail: "Traffic / transit tech and related systems",
          },
          {
            icon: "🚗",
            title: "Automotive",
            detail: "OEMs and Tier suppliers, China market experience",
          },
          {
            icon: "🔌",
            title: "Electronics Manufacturing",
            detail: "Industrial electronics / EMS contexts",
          },
          {
            icon: "📦",
            title: "Intralogistics / Warehousing",
            detail: "Supply-chain execution and logistics automation",
          },
        ].map((card) => (
          <div key={card.title} className={styles.flashcard}>
            <div className={styles.flashcardHeader}>
              <span className={styles.flashcardIcon}>{card.icon}</span>
              <h4>{card.title}</h4>
            </div>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SkillsSection;
