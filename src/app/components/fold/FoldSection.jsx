import Link from "next/link";
import {useTranslation} from "react-i18next";

import {useCookieConsent} from "../consent/CookieConsent";
import {useSyncExternalStore} from "react";
import FoldHeadline from "./FoldHeadline";
import SkillsMap from "../skills/SkillsMap";
import styles from "./fold-section.module.css";
import "../../buttons.css";

const FOLD_MAP_CENTER = [42, 28];
const FOLD_MAP_SPIN_SPEED = 2.8;
const FOLD_MAP_ZOOM = 2.5;

const subscribe = () => () => {};
const FoldSection = ({content}) => {
  const {allowExternalServices} = useCookieConsent();
  const {i18n, t} = useTranslation();
  // Match the server's selected first-render language; adopt the site's language after
  // hydration without fetching editorial content or leaving an empty headline.
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  const language = hydrated ? String(i18n.resolvedLanguage || i18n.language || 'en').split('-')[0] : (content.language || 'en');
  const copy = content.translations[language] || content.translations.en;
  const bookingUrl = content.bookingUrl || '';

  return (
    <header className={styles.hero} lang={language}>
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
          skeletonLabel={t("offer.mapLoading", {
            defaultValue: "Loading experience map",
          })}
          spinSpeed={FOLD_MAP_SPIN_SPEED}
          zoom={FOLD_MAP_ZOOM}
        />
      </div>
      <div className={styles.mapOverlay} aria-hidden />

      <div className={styles.content}>
        <div className={styles.copy}>
          {content.showEyebrow && copy.eyebrow && <p className={styles.eyebrow}>{copy.eyebrow}</p>}
          <h1><FoldHeadline segments={copy.headline} /></h1>
          <p className={styles.lead}>{copy.subheadline}</p>
          <p className={styles.usp}>{copy.statement}</p>
        </div>

        <ul className={styles.offerings}>
          {copy.cards.map((card, index) => (
            <li key={index}><strong>{card.title}</strong><br />{card.description}</li>
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
              {copy.ctaLabels.booking}
            </Link>
          )}
          <Link
            href={content.destinations.linkedin.url}
            className="secondary"
            target="_blank"
            rel="noreferrer"
          >
            {copy.ctaLabels.linkedin}
          </Link>
        </div>
      </div>
    </header>
  );
};

export default FoldSection;
