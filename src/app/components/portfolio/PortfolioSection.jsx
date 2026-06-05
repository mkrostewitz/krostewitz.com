import {useEffect, useMemo, useState} from "react";
import Link from "next/link";
import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import "../../buttons.css";
import styles from "./portfolio-section.module.css";

const skeletonItems = Array.from({length: 3}, (_, index) => index);

const PortfolioSection = () => {
  const {t, i18n} = useTranslation();
  const [state, setState] = useState({
    loading: true,
    projects: [],
    profileUrl: null,
    source: null,
    error: null,
  });

  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language || "en", {
        month: "short",
        year: "numeric",
      }),
    [i18n.language, i18n.resolvedLanguage],
  );

  useEffect(() => {
    const controller = new AbortController();

    async function loadProjects() {
      try {
        const response = await fetch("/api/github/projects", {
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load GitHub projects.");
        }

        setState({
          loading: false,
          projects: data.projects || [],
          profileUrl: data.profileUrl || null,
          source: data.source || null,
          error: null,
        });
      } catch (error) {
        if (error.name === "AbortError") return;
        console.error("Portfolio load error", error);
        setState((current) => ({
          ...current,
          loading: false,
          error: error.message,
        }));
      }
    }

    loadProjects();

    return () => controller.abort();
  }, []);

  const formatUpdatedAt = (value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return formatter.format(date);
  };

  return (
    <section
      id="portfolio"
      className={pageStyles.section}
      aria-busy={state.loading}
    >
      <div className={styles.headerRow}>
        <div className={pageStyles.sectionHeader}>
          <p className={pageStyles.eyebrow}>{t("portfolio.eyebrow")}</p>
          <h2>{t("portfolio.title")}</h2>
          <p className={pageStyles.lead}>{t("portfolio.subtitle")}</p>
        </div>
        {state.profileUrl && (
          <Link
            href={state.profileUrl}
            className="secondary"
            target="_blank"
            rel="noreferrer"
          >
            {t("portfolio.githubProfile")}
          </Link>
        )}
      </div>

      {state.loading && (
        <div
          className={styles.projectsGrid}
          role="status"
          aria-label={t("portfolio.loading")}
        >
          {skeletonItems.map((item) => (
            <div key={item} className={styles.skeletonCard} aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          ))}
        </div>
      )}

      {!state.loading && state.error && (
        <div className={styles.message}>
          <p>{t("portfolio.error")}</p>
        </div>
      )}

      {!state.loading && !state.error && state.projects.length === 0 && (
        <div className={styles.message}>
          <p>{t("portfolio.empty")}</p>
        </div>
      )}

      {!state.loading && !state.error && state.projects.length > 0 && (
        <div className={styles.projectsGrid}>
          {state.projects.map((project) => {
            const updatedAt = formatUpdatedAt(project.updatedAt);
            const tags = [
              project.language,
              ...(Array.isArray(project.topics)
                ? project.topics.slice(0, 3)
                : []),
            ].filter(Boolean);

            return (
              <article
                key={project.id || project.fullName}
                className={styles.projectCard}
              >
                <div className={styles.projectTop}>
                  <div>
                    <p className={styles.repoName}>{project.fullName}</p>
                    <h3>
                      <Link href={project.url} target="_blank" rel="noreferrer">
                        {project.name}
                      </Link>
                    </h3>
                  </div>
                  <Link
                    href={project.url}
                    className={styles.repoButton}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={t("portfolio.openRepo", {name: project.name})}
                  >
                    GitHub
                  </Link>
                </div>

                <p className={styles.description}>
                  {project.description || t("portfolio.noDescription")}
                </p>

                {tags.length > 0 && (
                  <div className={styles.tags}>
                    {tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                )}

                <div className={styles.projectMeta}>
                  <span>
                    {t("portfolio.stars", {count: project.stars || 0})}
                  </span>
                  <span>
                    {t("portfolio.forks", {count: project.forks || 0})}
                  </span>
                  {updatedAt && (
                    <span>{t("portfolio.updated", {date: updatedAt})}</span>
                  )}
                </div>

                <div className={styles.projectLinks}>
                  {project.homepage && (
                    <Link
                      href={project.homepage}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {t("portfolio.liveProject")}
                    </Link>
                  )}
                  <Link href={project.url} target="_blank" rel="noreferrer">
                    {t("portfolio.viewCode")}
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default PortfolioSection;
