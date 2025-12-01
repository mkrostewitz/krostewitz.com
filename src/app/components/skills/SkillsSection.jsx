import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./skills-section.module.css";

const SkillsSection = ({skills}) => {
  const {t} = useTranslation();

  return (
    <section className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("skills.title")}</p>
        <h2>{t("skills.title")}</h2>
      </div>
      <div className={styles.skills}>
        {skills.map((skill) => (
          <div key={skill.label} className={styles.skill}>
            <div className={styles.skillTop}>
              <span>{skill.label}</span>
              <span>{skill.value}%</span>
            </div>
            <div className={styles.skillBar}>
              <div
                className={styles.skillFill}
                style={{"--target": `${skill.value}%`}}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default SkillsSection;
