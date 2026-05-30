"use client";

import Link from "next/link";
import {useTranslation} from "react-i18next";

import "../../../lib/i18n";
import styles from "./public-footer.module.css";

export default function PublicFooter() {
  const {t} = useTranslation();
  const year = new Date().getFullYear();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Mathias Krostewitz";

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>© {year} {siteName}</span>
        <nav aria-label={t("footer.legalLabel")} className={styles.links}>
          <Link href="/impressum">{t("footer.impressum")}</Link>
          <Link href="/privacy">{t("footer.privacy")}</Link>
        </nav>
      </div>
    </footer>
  );
}
