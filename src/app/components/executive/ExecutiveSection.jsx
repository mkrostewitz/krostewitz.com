import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import {useInViewOnce} from "@/lib/useInViewOnce";
import pageStyles from "../../page.module.css";
import styles from "./executive-section.module.css";

function useCountUp(target, duration = 2000, shouldStart = false) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!shouldStart) return;

    let raf;
    let startTime;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = target * eased;
      const decimals = Number.isInteger(target) ? 0 : 1;
      setValue(Number(next.toFixed(decimals)));
      if (progress < 1) {
        raf = requestAnimationFrame(step);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, shouldStart]);

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
    []
  );

  const [sectionRef, isInView] = useInViewOnce({
    threshold: 0.45,
    rootMargin: "0px 0px -25% 0px",
  });
  const leadershipYears = useCountUp(stats.leadershipYears, 2200, isInView);
  const revenue = useCountUp(stats.revenue, 2200, isInView);
  const markets = useCountUp(stats.markets, 2200, isInView);

  return (
    <section
      id="executiveSummary"
      className={pageStyles.section}
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
          {leadershipYears}
          <span className={styles.statSuffix}>+</span>
        </div>
          <div
            className={`${styles.sparkline} ${
              isInView ? styles.sparklineVisible : ""
            }`}
          >
            {skills.map((skill, idx) => (
              <span
                key={`${skill.label}-${idx}`}
                style={{
                  "--bar-height": `${
                    Math.min(Math.max(skill.score ?? 0, 0), 10) * 10
                  }%`,
                  "--bar-delay": `${idx * 80}ms`,
                }}
                title={skill.label}
              />
            ))}
          </div>
        </div>
        <div
          className={styles.statGrid}
          style={{display: "flex", flexDirection: "column", gap: "1rem"}}
        >
          {/* Stats Section */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              gap: "2rem",
              justifyContent: "space-between",
            }}
          >
            <div>
              <p>{t("stats.revenuePerHead")}</p>
              <strong>{revenue}M US$</strong>
            </div>
            <div>
              <p>{t("stats.markets")}</p>
              <strong>{markets}</strong>
            </div>
          </div>

          {/* Languages Section */}
          <div>
            <div
              style={{display: "flex", flexDirection: "column", gap: "0.5rem"}}
            >
              <p>{t("languages.title")}</p>
              <div className={styles.languagesGrid}>
                {languageList.map((lang) => (
                  <div key={lang.code} className={styles.languageCard}>
                    <div className={styles.languageIcon}>{lang.code}</div>
                    <div>
                      <p className={styles.languageName}>{lang.name}</p>
                      <p className={styles.languageLevel}>{lang.level}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ExecutiveSummary;
