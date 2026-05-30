"use client";

import Link from "next/link";
import {useEffect} from "react";
import {useTranslation} from "react-i18next";

import {loadRuntimeTranslations} from "../../../lib/i18n";
import styles from "./blog-post.module.css";

export default function BlogBackLink() {
  const {i18n, t} = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language || "en";
  const defaultLabel = language.toLowerCase().startsWith("de")
    ? "Zur\u00fcck zum Blog"
    : "Back to blog";

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  return (
    <Link className={styles.backLink} href="/#blog">
      {t("blog.backToBlog", {defaultValue: defaultLabel})}
    </Link>
  );
}
