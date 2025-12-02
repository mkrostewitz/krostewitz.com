import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";

const ExecutiveSummary = () => {
  const {t} = useTranslation();
  const executiveSummary = t("executiveSummary", {returnObjects: true});

  return (
    <section id="executiveSummary" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.executiveSummary")}</p>
        <h2>{t("nav.executiveSummary")}</h2>
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
