import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./timeline-section.module.css";

const TimelineSection = () => {
  const {t} = useTranslation();
  const timeline = t("timeline", {returnObjects: true});

  return (
    <section id="timeline" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.timeline")}</p>
        <h2>{t("nav.timeline")}</h2>
      </div>
      <div className={styles.timeline}>
        {timeline.map((item) => (
          <div key={item.title} className={styles.timelineItem}>
            <div className={styles.timelineBadge}>{item.period}</div>
            <div className={styles.timelineBody}>
              <h3>{item.title}</h3>
              <p className={styles.location}>{item.location}</p>
              <p>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default TimelineSection;
