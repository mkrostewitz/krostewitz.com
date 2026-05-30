"use client";

import {ArrowLeft, FileQuestion, Home, Mail, Search} from "lucide-react";
import Link from "next/link";
import {useEffect} from "react";
import {useTranslation} from "react-i18next";

import {loadRuntimeTranslations} from "../lib/i18n";
import styles from "./not-found.module.css";

export default function NotFoundContent() {
  const {t} = useTranslation();
  const metaTitle = t("notFound.metaTitle");

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    document.title = metaTitle;
  }, [metaTitle]);

  return (
    <section className={styles.hero} aria-labelledby="not-found-title">
      <div className={styles.copy}>
        <p className={styles.eyebrow}>{t("notFound.eyebrow")}</p>
        <h1 id="not-found-title">{t("notFound.title")}</h1>
        <p className={styles.lead}>{t("notFound.lead")}</p>

        <div
          className={styles.actions}
          aria-label={t("notFound.actionsLabel")}
        >
          <Link className={`primary ${styles.primaryAction}`} href="/">
            <Home aria-hidden="true" size={18} strokeWidth={2.4} />
            {t("notFound.actions.home")}
          </Link>
          <Link className={`secondary ${styles.secondaryAction}`} href="/#blog">
            <Search aria-hidden="true" size={18} strokeWidth={2.4} />
            {t("notFound.actions.blog")}
          </Link>
          <Link className={styles.textAction} href="/#contact">
            <Mail aria-hidden="true" size={18} strokeWidth={2.4} />
            {t("notFound.actions.contact")}
          </Link>
        </div>
      </div>

      <div className={styles.visual} aria-hidden="true">
        <div className={styles.statusCard}>
          <div className={styles.statusTop}>
            <span />
            <span />
            <span />
          </div>
          <div className={styles.statusBody}>
            <FileQuestion size={46} strokeWidth={1.7} />
            <div>
              <span className={styles.code}>404</span>
              <p>{t("notFound.visual.status")}</p>
            </div>
          </div>
          <div className={styles.trace}>
            <span />
            <span />
            <span />
          </div>
        </div>
        <div className={styles.routeLine}>
          <ArrowLeft size={22} strokeWidth={2.2} />
        </div>
      </div>
    </section>
  );
}
