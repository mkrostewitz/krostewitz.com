import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./languages-section.module.css";

const LanguagesSection = () => {
  const {t} = useTranslation();
  const languages = t("languages.list", {returnObjects: true});

  return (
    <section className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("languages.title")}</p>
        <h2>{t("languages.title")}</h2>
      </div>
      <div className={styles.grid}>
        {languages.map((lang) => (
          <div key={lang.code} className={styles.card}>
            <div className={styles.icon}>{lang.code}</div>
            <div>
              <p className={styles.name}>{lang.name}</p>
              <p className={styles.level}>{lang.level}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LanguagesSection;
