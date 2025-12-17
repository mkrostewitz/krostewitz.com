import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./executive-section.module.css";

function useCountUp(target, duration = 2000) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf;
    let start;
    const step = (timestamp) => {
      if (!start) start = timestamp;
      const progress = Math.min((timestamp - start) / duration, 1);
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
  }, [target, duration]);

  return value;
}

const ExecutiveSummary = ({skills = []}) => {
  const {t} = useTranslation();
  const executiveSummary = t("executiveSummary", {returnObjects: true});
  const stats = useMemo(
    () => ({
      leadershipYears: 15,
      revenue: 253.5,
      markets: 4,
    }),
    []
  );

  const leadershipYears = useCountUp(stats.leadershipYears, 2200);
  const revenue = useCountUp(stats.revenue, 2200);
  const markets = useCountUp(stats.markets, 2200);

  return (
    <section id="executiveSummary" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.executiveSummary")}</p>
        <h2>{t("nav.executiveSummary")}</h2>
      </div>

      <div className={styles.summaryCard}>
        <div className={styles.statColumn}>
          <div className={styles.statLabel}>{t("stats.yearsLeadership")}</div>
          <div className={styles.statValue}>
            {leadershipYears}
            <span className={styles.statSuffix}>+</span>
          </div>
          <div className={styles.sparkline}>
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
        <div className={styles.statGrid}>
          <div>
            <p>{t("stats.revenuePerHead")}</p>
            <strong>{revenue}M USD</strong>
          </div>
          <div>
            <p>{t("stats.markets")}</p>
            <strong>{markets}</strong>
          </div>
        </div>
      </div>

      <div className={pageStyles.cards}>
        {executiveSummary.map((item) => (
          <article key={item.title} className={pageStyles.card}>
            <div className={pageStyles.cardMeta}>{item.role}</div>
            <h3>{item.title}</h3>
            <p>{item.impact}</p>
          </article>
        ))}
      </div>
    </section>
  );
};

export default ExecutiveSummary;
