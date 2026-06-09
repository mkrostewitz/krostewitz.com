import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import {useInViewOnce} from "@/lib/useInViewOnce";
import pageStyles from "../../page.module.css";
import styles from "./executive-section.module.css";

function readFiniteNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function formatStatNumber(value, maximumFractionDigits = 0) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: Number.isInteger(value) ? 0 : maximumFractionDigits,
  }).format(value);
}

function useCountUp(target, duration = 2000, shouldStart = false) {
  const [value, setValue] = useState(null);

  useEffect(() => {
    if (!shouldStart || target === null) {
      return undefined;
    }

    let raf;
    let startTime;
    const minimumVisibleValue = target > 0 ? (Number.isInteger(target) ? 1 : 0.1) : target;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;

      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const decimals = Number.isInteger(target) ? 0 : 1;
      const nextValue = Number((target * eased).toFixed(decimals));

      setValue(
        progress >= 1
          ? target
          : Math.min(target, Math.max(minimumVisibleValue, nextValue)),
      );

      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [duration, shouldStart, target]);

  return value;
}

const ExecutiveSummary = ({skills = []}) => {
  const {t} = useTranslation(undefined, {
    keyPrefix: "executiveSummary",
  });

  const languages = t("languages.list", {
    returnObjects: true,
  });

  const languageList = Array.isArray(languages) ? languages : [];

  const stats = useMemo(
    () => ({
      leadershipYears: 15,
      revenue: 253.5,
      markets: 4,
    }),
    [],
  );

  const leadershipYears = readFiniteNumber(stats.leadershipYears);
  const revenue = readFiniteNumber(stats.revenue);
  const markets = readFiniteNumber(stats.markets);
  const hasSkillData = Array.isArray(skills);
  const skillBars = hasSkillData
    ? skills
        .map((skill, index) => ({
          id: `${skill?.label || "skill"}-${index}`,
          label: String(skill?.label || "").trim(),
          score: readFiniteNumber(skill?.score),
        }))
        .filter((skill) => skill.score !== null)
    : [];
  const isStatsLoading =
    leadershipYears === null || revenue === null || markets === null;
  const [sectionRef, isInView] = useInViewOnce({
    threshold: 0.2,
    rootMargin: "0px",
  });
  const animatedLeadershipYears = useCountUp(
    leadershipYears,
    2200,
    isInView && leadershipYears !== null,
  );
  const animatedRevenue = useCountUp(revenue, 2200, isInView && revenue !== null);
  const animatedMarkets = useCountUp(markets, 2200, isInView && markets !== null);
  const isAnimationLoading =
    animatedLeadershipYears === null ||
    animatedRevenue === null ||
    animatedMarkets === null;

  return (
    <section
      id="executiveSummary"
      className={`${pageStyles.section} ${styles.section}`}
      aria-busy={isStatsLoading || isAnimationLoading}
      ref={sectionRef}
    >
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("eyebrow")}</p>
        <h2>{t("title")}</h2>
      </div>

      <div className={styles.summaryCard}>
        {/* Stats Section */}
        <div className={styles.statColumn}>
          <div className={styles.statLabel}>{t("stats.yearsLeadership")}</div>
          <div className={styles.statValue}>
            {animatedLeadershipYears === null ? (
              <span className={`${styles.valueSkeleton} ${styles.valueSkeletonLarge}`} />
            ) : (
              <>
                {formatStatNumber(animatedLeadershipYears)}
                <span className={styles.statSuffix}>+</span>
              </>
            )}
          </div>
          <div
            className={styles.sparkline}
            data-active={isInView && skillBars.length ? "true" : undefined}
            data-loading={
              !hasSkillData || (!isInView && skillBars.length > 0)
                ? "true"
                : undefined
            }
          >
            {skillBars.length ? skillBars.map((skill, index) => (
              <span
                key={skill.id}
                style={{
                  "--bar-height": `${
                    Math.min(Math.max(skill.score, 0), 10) * 10
                  }%`,
                  "--bar-delay": `${index * 80}ms`,
                }}
                title={skill.label}
              />
            )) : !hasSkillData ? Array.from({length: 6}, (_, index) => (
              <span key={`sparkline-skeleton-${index}`} />
            )) : null}
          </div>
        </div>
        <div className={styles.statGrid}>
          {/* Stats Section */}
          <div className={styles.outcomeGrid}>
            <div className={styles.outcome}>
              <p>{t("stats.revenuePerHead")}</p>
              {animatedRevenue === null ? (
                <span className={styles.valueSkeleton} />
              ) : (
                <strong>{formatStatNumber(animatedRevenue, 1)}M US$</strong>
              )}
            </div>
            <div className={styles.outcome}>
              <p>{t("stats.markets")}</p>
              {animatedMarkets === null ? (
                <span className={styles.valueSkeleton} />
              ) : (
                <strong>{formatStatNumber(animatedMarkets)}</strong>
              )}
            </div>
          </div>

          {/* Languages Section */}
          <div className={styles.languagesGroup}>
            <p>{t("languages.title")}</p>
            <div className={styles.languagesGrid}>
              {languageList.map((lang) => (
                <div key={lang.code} className={styles.languageCard}>
                  <div className={styles.languageIcon}>{lang.code}</div>
                  <div className={styles.languageText}>
                    <p className={styles.languageName}>{lang.name}</p>
                    <p className={styles.languageLevel}>{lang.level}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExecutiveSummary;
