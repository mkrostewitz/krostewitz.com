import {Dialog, DialogTitle, DialogContent, IconButton} from "@mui/material";
import {Hand, Info, X} from "lucide-react";
import AdminMuiProvider from "../../admin/components/forms/AdminMuiProvider";
import IndustryIcon from '../IndustryIcon';
import {useTranslation} from "react-i18next";
import {useId, useState} from "react";

import {useInViewOnce} from "@/lib/useInViewOnce";
import pageStyles from "../../page.module.css";
import {useCookieConsent} from "../consent/CookieConsent";
import SkillsMap from "./SkillsMap";
import styles from "./skills-section.module.css";

const EMPTY_COUNTRIES = [];
const INITIAL_SKILL_COUNT = 5;
const INITIAL_INDUSTRY_COUNT = 6;
const SKILL_SKELETON_ROWS = Array.from({length: INITIAL_SKILL_COUNT}, (_, index) => index);

const SkillsSection = ({skills, countries, initialCountry, industries = [], loadError = false}) => {
  const mapHintId = useId();
  const [rotationPaused, setRotationPaused] = useState(false);
  const [selectedDetails, setSelectedDetails] = useState(null);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [showAllIndustries, setShowAllIndustries] = useState(false);
  const {t} = useTranslation(undefined, {keyPrefix: "skills"});
  const showCountryCompanies = country => setSelectedDetails({
    label: country.label,
    content: <div className={styles.coverageTooltip}>
      <p>{t("map.companiesTitle")}</p>
      {country.companies?.length ? <ul>{country.companies.map(company => <li key={company}>{company}</li>)}</ul> : <p>{t("map.noCompanies")}</p>}
    </div>,
  });
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

  const hasSkillData = Array.isArray(skills);
  const skillList = hasSkillData
    ? [...skills].sort((a, b) => (b.usage?.percentage ?? -1) - (a.usage?.percentage ?? -1))
    : [];
  const visibleSkills = showAllSkills ? skillList : skillList.slice(0, INITIAL_SKILL_COUNT);
  const visibleIndustries = showAllIndustries ? industries : industries.slice(0, INITIAL_INDUSTRY_COUNT);
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
      <div id="impact-areas-list" className={styles.skills}>
        {skillList.length ? visibleSkills.map((skill, idx) => {
          const usage = skill.usage;
          const hasScore = Boolean(usage);
          const fillScale = usage ? usage.percentage / 100 : 0;
          const usageText = usage ? t("timeCoverageAccessible", {
            percentage: Math.round(usage.percentage),
          }) : t(loadError ? "coverageUnavailable" : "coverageLoading");
          const details = usage ? (
            <div className={styles.coverageTooltip}>
              <p>{t("engagementCoverage", {percentage: Math.round(usage.engagementPercentage ?? 0)})}</p>
              {usage.companies?.length > 0 && <>
                <strong>{t("engagementCompanies")}</strong>
                <ul>{usage.companies.map(company => <li key={company}>{company}</li>)}</ul>
              </>}
              <p>{t("timeRankingExplanation")}</p>
            </div>
          ) : usageText;
          return (
            <div key={skill.id} className={styles.skill}>
              <div className={styles.skillTop}>
                <div>
                  <span className={styles.label}>{skill.label}</span>
                  {skill.detail && (
                    <p className={styles.detail}>{skill.detail}</p>
                  )}
                </div>
                <button type="button" className={styles.infoButton} aria-label={t("engagementDetails", {label: skill.label})} aria-haspopup="dialog" onClick={() => setSelectedDetails({label: skill.label, content: details})}>
                  <Info size={18} aria-hidden="true" />
                </button>
              </div>
              <div
                className={styles.skillBar}
                role={hasScore ? "meter" : undefined}
                aria-label={skill.label}
                aria-valuemin={hasScore ? 0 : undefined}
                aria-valuemax={hasScore ? 100 : undefined}
                aria-valuenow={usage?.percentage}
                aria-valuetext={hasScore ? usageText : undefined}
                data-loading={(!hasScore && !loadError) || !isSkillsInView || undefined}
                aria-busy={(!hasScore && !loadError) || !isSkillsInView || undefined}
              >
                {hasScore && isSkillsInView ? (
                  <div
                    className={styles.skillFill}
                    data-active="true"
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
      <AdminMuiProvider>
        <Dialog open={Boolean(selectedDetails)} onClose={() => setSelectedDetails(null)} maxWidth="sm" fullWidth aria-labelledby="impact-area-details-title">
          <DialogTitle id="impact-area-details-title" sx={{display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2}}>
            {selectedDetails?.label}
            <IconButton aria-label={t("closeDetails")} onClick={() => setSelectedDetails(null)}>
              <X size={20} />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers>{selectedDetails?.content}</DialogContent>
        </Dialog>
      </AdminMuiProvider>
      {skillList.length > INITIAL_SKILL_COUNT && (
        <button
          type="button"
          className={styles.showMoreButton}
          aria-expanded={showAllSkills}
          aria-controls="impact-areas-list"
          onClick={() => setShowAllSkills((previous) => !previous)}
        >
          {t(showAllSkills ? "showLess" : "showMore")}
        </button>
      )}
      <div className={styles.flashcardsHeader}>
        <h2>{t("industriesTitle")}</h2>
      </div>

      <div id="industry-expertise-list" className={styles.flashcards}>
        {visibleIndustries.map(card => {

          return (
            <div key={card.id} className={styles.flashcard}>
              <div className={styles.flashcardHeader}>
                <span className={styles.flashcardIcon} aria-hidden="true">
                  <IndustryIcon industry={card} size={18} />
                </span>
                <div className={styles.flashcardBody}>
                  <h4>{card.label}</h4>
                  {card.detail && <p>{card.detail}</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {industries.length > INITIAL_INDUSTRY_COUNT && (
        <button
          type="button"
          className={styles.showMoreButton}
          aria-expanded={showAllIndustries}
          aria-controls="industry-expertise-list"
          onClick={() => setShowAllIndustries(previous => !previous)}
        >
          {t(showAllIndustries ? "showLess" : "showMore")}
        </button>
      )}

      <div className={styles.mapSection}>
        <div className={styles.mapSectionHeader}>
          <p className={styles.mapEyebrow}>{t("map.eyebrow")}</p>
          <h2>{t("map.title")}</h2>
          <p className={pageStyles.lead}>{t("map.subtitle")}</p>
        </div>

        <div className={styles.mapShell}>
          {canShowMapFrame ? (
            <>
              <div className={styles.mapStage} role="group" aria-label={t("map.title")} aria-describedby={allowExternalServices ? mapHintId : undefined}>
                <SkillsMap
                  ref={mapRefObserver}
                  experienceCountries={countries || EMPTY_COUNTRIES}
                  initialCountry={initialCountry}
                  autoSpin={!rotationPaused && !selectedDetails}
                  onCountrySelect={showCountryCompanies}
                  spinSpeed={3.5}
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
                {allowExternalServices && <p id={mapHintId} className={styles.mapHint}>
                  <Hand size={15} aria-hidden="true" />
                  <span className={styles.mouseHint}>{t("map.interactionHint")}</span>
                  <span className={styles.touchHint}>{t("map.touchInteractionHint")}</span>
                </p>}
              </div>
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
                  <select className={styles.countryPicker} value="" aria-label={t("map.companiesByCountry")}
                    onChange={event => {
                      const country = countries?.find(item => item.id === event.target.value);
                      if (country) showCountryCompanies(country);
                    }}>
                    <option value="" disabled>{t("map.companiesByCountry")}</option>
                    {countries?.map(country => <option key={country.id} value={country.id}>{country.label}</option>)}
                  </select>
                  <button type="button" className={styles.rotationButton} aria-pressed={rotationPaused}
                    onClick={() => setRotationPaused(paused => !paused)}>
                    {t(rotationPaused ? "map.resumeRotation" : "map.pauseRotation")}
                  </button>
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
