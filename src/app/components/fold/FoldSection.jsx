import Image from "next/image";
import Link from "next/link";
import {useTranslation} from "react-i18next";

import styles from "./fold-section.module.css";

const FoldSection = () => {
  const {t} = useTranslation();
  const points = t("offer.points", {returnObjects: true});

  return (
    <header className={styles.hero}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{t("offer.eyebrow")}</p>
        <h2>{t("offer.title")}</h2>
        <p className={styles.lead}>{t("offer.subtitle")}</p>
        <ul className={styles.points}>
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link
            href="https://koalendar.com/e/meet-with-mathias-krostewitz"
            className={styles.primary}
            target="_blank"
            rel="noreferrer"
          >
            {t("offer.cta")}
          </Link>
          <Link
            href="https://www.linkedin.com/in/mkrostewitz"
            className={styles.secondary}
            target="_blank"
            rel="noreferrer"
          >
            {t("linkedin")}
          </Link>
        </div>
      </div>
      <div className={styles.portraitShell}>
        <Image
          src="/mk.png"
          alt={t("offer.alt")}
          fill
          sizes="(max-width: 960px) 100vw, 38vw"
          className={styles.portrait}
          priority
        />
      </div>
    </header>
  );
};

export default FoldSection;
