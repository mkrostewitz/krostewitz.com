import Link from "next/link";
import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./fold-section.module.css";

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

const FoldSection = ({skills}) => {
  const {t} = useTranslation();

  const leadershipYears = useCountUp(15, 2200);
  const revenue = useCountUp(35.5, 2200);
  const markets = useCountUp(9, 2200);
  const launches = useCountUp(10, 2200);

  return (
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroText}>
          <p className={styles.preTitle}>{t("hero.kicker")}</p>
          <h1 className={styles.title}>{t("hero.title")}</h1>
          <p className={styles.subtitle}>{t("hero.subtitle")}</p>
          <div className={styles.actions}>
            <Link
              href="https://koalendar.com/e/meet-with-mathias-krostewitz"
              className={pageStyles.primary}
              target="_blank"
              rel="noreferrer"
            >
              {t("hero.booking")}
            </Link>
            <a className={pageStyles.secondary} href="#contact">
              {t("hero.contact")}
            </a>
            <Link
              href="https://www.linkedin.com/in/mkrostewitz"
              className={pageStyles.secondaryGhost}
              target="_blank"
              rel="noreferrer"
            >
              {t("linkedin")}
            </Link>
          </div>
        </div>

        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>{t("stats.yearsLeadership")}</div>
          <div className={styles.metricValue}>
            {leadershipYears}
            <span className={styles.metricSuffix}>+</span>
          </div>
          <div className={styles.metricBars}>
            <div className={styles.sparkline}>
              {skills.map((skill, idx) => (
                <span
                  key={skill.label}
                  style={{
                    "--bar-height": `${Math.min(skill.value, 100)}%`,
                    "--bar-delay": `${idx * 90}ms`,
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
            <div>
              <p>{t("stats.product")}</p>
              <strong>{launches}</strong>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default FoldSection;
