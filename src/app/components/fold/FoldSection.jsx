import Link from "next/link";
import {Trans, useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import {useCookieConsent} from "../consent/CookieConsent";
import {usePublicSettings} from "../public-settings/PublicSettingsProvider";
import SkillsMap from "../skills/SkillsMap";
import styles from "./fold-section.module.css";
import "../../buttons.css";

const FOLD_MAP_CENTER = [42, 28];
const FOLD_MAP_SPIN_SPEED = 2.8;
const FOLD_MAP_ZOOM = 2.5;

const FoldSection = () => {
  const {bookingUrl} = usePublicSettings();
  const {allowExternalServices} = useCookieConsent();
  const {t} = useTranslation(undefined, {
    keyPrefix: "offer",
  });
  const {t: transButtons} = useTranslation(null, {
    keyPrefix: "buttons",
  });
  const points = t("points", {returnObjects: true});

  return (
    <header className={styles.hero}>
      <div className={styles.mapBackground}>
        <SkillsMap
          allowExternalServices={allowExternalServices}
          attributionControl={false}
          autoSpin
          center={FOLD_MAP_CENTER}
          className={styles.mapFrame}
          interactive={false}
          isActive
          mapClassName={styles.map}
          skeletonClassName={styles.mapSkeleton}
          skeletonLabel={t("mapLoading", {
            defaultValue: "Loading experience map",
          })}
          spinSpeed={FOLD_MAP_SPIN_SPEED}
          zoom={FOLD_MAP_ZOOM}
        />
      </div>
      <div className={styles.mapOverlay} aria-hidden />

      <div className={styles.content}>
        <div className={styles.copy}>
          {/* <p className={`${pageStyles.eyebrow} ${styles.eyebrow}`}>
            {t("eyebrow")}
          </p> */}
          <h1 dangerouslySetInnerHTML={{__html: t("title")}} />

          <p className={styles.lead}>
            <Trans i18nKey="offer.subtitle" components={{br: <br />}}>
              {t("subtitle")}
            </Trans>
          </p>

          <p className={styles.usp}>{t("usp")}</p>
        </div>

        <ul className={styles.offerings}>
          {points.map((point, index) => (
            <li key={point}>
              <Trans
                i18nKey={`offer.points.${index}`}
                components={{br: <br />, strong: <strong />}}
              >
                {point}
              </Trans>
            </li>
          ))}
        </ul>

        <div className={styles.actions}>
          {bookingUrl && (
            <Link
              href={bookingUrl}
              className="primary"
              target="_blank"
              rel="noreferrer"
            >
              {transButtons("booking")}
            </Link>
          )}
          <Link
            href="https://www.linkedin.com/in/mkrostewitz"
            className="secondary"
            target="_blank"
            rel="noreferrer"
          >
            {transButtons("linkedin")}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default FoldSection;
