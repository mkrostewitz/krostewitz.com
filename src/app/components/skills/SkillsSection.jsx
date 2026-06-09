import {
  CarFront,
  CircuitBoard,
  Cog,
  Factory,
  TrainFront,
  Warehouse,
} from "lucide-react";
import {useTranslation} from "react-i18next";

import {useInViewOnce} from "@/lib/useInViewOnce";
import pageStyles from "../../page.module.css";
import {useCookieConsent} from "../consent/CookieConsent";
import SkillsMap from "./SkillsMap";
import styles from "./skills-section.module.css";

const SKILL_SKELETON_ROWS = Array.from({length: 6}, (_, index) => index);

const INDUSTRY_ICONS = {
  factory: Factory,
  automation: Cog,
  infrastructure: TrainFront,
  automotive: CarFront,
  electronics: CircuitBoard,
  intralogistics: Warehouse,
};

const DEFAULT_INDUSTRY_ICONS = [
  Factory,
  Cog,
  TrainFront,
  CarFront,
  CircuitBoard,
  Warehouse,
];

function readFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

const SkillsSection = ({skills}) => {
  const {t} = useTranslation(undefined, {keyPrefix: "skills"});
  const {t: tConsent} = useTranslation(undefined, {
    keyPrefix: "cookieConsent",
  });
  const {
    allowExternalServices,
    isReady: isConsentReady,
    openConsentSettings,
  } = useCookieConsent();
  const [sectionRef, isSkillsInView] = useInViewOnce({
    threshold: 0.2,
    rootMargin: "0px 0px -5% 0px",
  });
  const [mapRefObserver, mapInView] = useInViewOnce({
    threshold: 0.2,
    rootMargin: "0px 0px -10% 0px",
  });
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const levelForScore = (score) => {
    if (score <= 4) return "support";
    if (score <= 8) return "lead";
    return "own";
  };

  const industries = t("industries", {
    returnObjects: true,
    defaultValue: [],
  });
  const hasSkillData = Array.isArray(skills);
  const skillList = hasSkillData ? skills : [];
  const canShowMapFrame = Boolean(
    token && (!isConsentReady || allowExternalServices)
  );
  const shouldShowMapSkeleton = Boolean(
    token && (!isConsentReady || allowExternalServices)
  );

  return (
    <section id="skills" className={pageStyles.section} ref={sectionRef}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("title")}</p>
        <h2>{t("headline")}</h2>
        <p className={pageStyles.lead}>{t("description")}</p>
      </div>
      <div className={styles.skills}>
        {skillList.length ? skillList.map((skill, idx) => {
          const score = readFiniteNumber(skill.score);
          const hasScore = score !== null;
          const level = levelForScore(score ?? 0);
          const clamped = hasScore ? Math.min(Math.max(score, 0), 10) : 0;
          const fillScale = clamped / 10;
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
              <div
                className={styles.skillBar}
                data-loading={!hasScore || !isSkillsInView || undefined}
                aria-busy={!hasScore || !isSkillsInView || undefined}
              >
                {hasScore && isSkillsInView ? (
                  <div
                    className={styles.skillFill}
                    data-active="true"
                    data-label={t(`levels.${level}`)}
                    style={{
                      "--fill-scale": fillScale,
                      "--animation-delay": `${idx * 0.08}s`,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        }) : !hasSkillData ? SKILL_SKELETON_ROWS.map((index) => (
          <div
            key={`skill-skeleton-${index}`}
            className={`${styles.skill} ${styles.skillSkeleton}`}
            aria-hidden
          >
            <span />
            <span />
            <div className={styles.skillBar} data-loading="true" />
          </div>
        )) : null}
      </div>
      {skillList.length || !hasSkillData ? (
        <div className={styles.legend}>
          <span>{t("levels.support")}</span>
          <span>{t("levels.lead")}</span>
          <span>{t("levels.own")}</span>
        </div>
      ) : null}

      <div className={styles.flashcardsHeader}>
        <h2>{t("industriesTitle")}</h2>
      </div>

      <div className={styles.flashcards}>
        {industries.map((card, idx) => {
          const Icon =
            INDUSTRY_ICONS[card.icon] ||
            DEFAULT_INDUSTRY_ICONS[idx % DEFAULT_INDUSTRY_ICONS.length];

          return (
            <div key={`${card.title}-${idx}`} className={styles.flashcard}>
              <div className={styles.flashcardHeader}>
                <span className={styles.flashcardIcon} aria-hidden="true">
                  <Icon size={18} strokeWidth={1.75} />
                </span>
                <div className={styles.flashcardBody}>
                  <h4>{card.title}</h4>
                  <p>{card.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.mapSection}>
        <div className={styles.mapSectionHeader}>
          <p className={styles.mapEyebrow}>{t("map.eyebrow")}</p>
          <h2>{t("map.title")}</h2>
          <p className={pageStyles.lead}>{t("map.subtitle")}</p>
        </div>

        <div className={styles.mapShell}>
          {canShowMapFrame ? (
            <>
              <SkillsMap
                ref={mapRefObserver}
                className={styles.mapFrame}
                mapClassName={styles.map}
                skeletonClassName={styles.mapSkeleton}
                allowExternalServices={allowExternalServices}
                isActive={mapInView}
                showSkeleton={shouldShowMapSkeleton}
                skeletonLabel={t("map.loading", {
                  defaultValue: "Loading experience map",
                })}
              />
              {allowExternalServices && (
                <div className={styles.mapLegend}>
                  <span>
                    <span className={`${styles.dot} ${styles.dotLived}`} />
                    {t("map.lived")}
                  </span>
                  <span>
                    <span className={`${styles.dot} ${styles.dotWorked}`} />
                    {t("map.worked")}
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className={styles.mapFallback}>
              <p>
                {token
                  ? tConsent("externalServicesBlocked")
                  : t("map.missingToken")}
              </p>
              {token ? (
                <button onClick={openConsentSettings} type="button">
                  {tConsent("actions.manage")}
                </button>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SkillsSection;
