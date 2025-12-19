import Image from "next/image";
import Link from "next/link";
import {Trans, useTranslation} from "react-i18next";

import styles from "./fold-section.module.css";

const FoldSection = () => {
  const {t} = useTranslation(undefined, {
    keyPrefix: "offer",
  });
  const {t: transButtons} = useTranslation(null, {
    keyPrefix: "buttons",
  });
  const points = t("points", {returnObjects: true});

  return (
    <header className={styles.hero}>
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{t("eyebrow")}</p>
        <h2>{t("title")}</h2>

        <p className={styles.lead}>
          <Trans i18nKey="offer.subtitle" components={{br: <br />}}>
            {t("subtitle")}
          </Trans>
        </p>

        <ul className={styles.points}>
          {points.map((point) => (
            <li key={point}>
              <Trans
                i18nKey={`offer.points.${point}`}
                components={{br: <br />, strong: <strong />}}
              >
                {point}
              </Trans>
            </li>
          ))}
        </ul>
        <div className={styles.actions}>
          <Link
            href="https://koalendar.com/e/meet-with-mathias-krostewitz"
            className={styles.primary}
            target="_blank"
            rel="noreferrer"
          >
            {transButtons("booking")}
          </Link>
          <Link
            href="https://www.linkedin.com/in/mkrostewitz"
            className={styles.secondary}
            target="_blank"
            rel="noreferrer"
          >
            {transButtons("linkedin")}
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
