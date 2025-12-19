import {Trans, useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./about-section.module.css";

const AboutSection = () => {
  const {t} = useTranslation();

  return (
    <section id="about" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.about")}</p>
        <h2>
          <Trans i18nKey="about.headline" components={{br: <br />}}>
            {t("about.headline")}
          </Trans>
        </h2>
      </div>
      <div className={styles.aboutGrid}>
        <p className={pageStyles.lead}>
          <Trans i18nKey="about.body" components={{strong: <strong />}}>
            {t("about.body")}
          </Trans>
        </p>
        <ul className={styles.highlightList}>
          {t("about.highlights", {returnObjects: true}).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default AboutSection;
