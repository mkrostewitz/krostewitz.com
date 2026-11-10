import Image from "next/image";
import {Trans, useTranslation} from "react-i18next";

import {usePublicSettings} from "../public-settings/PublicSettingsProvider";

import pageStyles from "../../page.module.css";
import styles from "./about-section.module.css";

const AboutSection = () => {
  const {t, i18n} = useTranslation();
  const {profile, profileName} = usePublicSettings();
  const about = profile.about;
  const photoUrl = about?.photoUrl ?? "/about-me.jpg";
  const language = String(i18n.resolvedLanguage || i18n.language || "en").split("-")[0];
  const copy = about?.translations?.[language] || about?.translations?.en;
  const headline = copy?.headline ?? t("about.headline");
  const body = copy?.body ?? t("about.body");
  const highlights = copy?.highlights ?? t("about.highlights", {returnObjects: true});

  return (
    <section id="about" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.about")}</p>
        <h2>
          <Trans defaults={headline} components={{br: <br />}}>
            {headline}
          </Trans>
        </h2>
      </div>

      <div className={`${styles.aboutGrid} ${!photoUrl ? styles.withoutPortrait : ""}`}>
        <div className={styles.aboutCopy}>
          <p className={pageStyles.lead}>
            <Trans defaults={body} components={{strong: <strong />}}>
              {body}
            </Trans>
          </p>

          <ul className={styles.highlightList}>
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        {photoUrl && <div className={styles.aboutMePortrait}>
          <Image
            src={photoUrl}
            alt={about?.photoAlt || profileName || "Portrait"}
            unoptimized
            className={styles.aboutMePortraitImage}
            fill
            sizes="(max-width: 960px) 100vw, 32vw"
          />
        </div>}
      </div>
    </section>
  );
};

export default AboutSection;
