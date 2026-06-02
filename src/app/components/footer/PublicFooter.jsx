"use client";

import Link from "next/link";
import {useTranslation} from "react-i18next";

import "../../../lib/i18n";
import {useCookieConsent} from "../consent/CookieConsent";
import styles from "./public-footer.module.css";

export default function PublicFooter() {
  const {t} = useTranslation();
  const {openConsentSettings} = useCookieConsent();
  const year = new Date().getFullYear();
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME;

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <span>
          © {year} {siteName}
        </span>
        <nav aria-label={t("footer.legalLabel")} className={styles.links}>
          <Link href="/impressum">{t("footer.impressum")}</Link>
          <Link href="/privacy">{t("footer.privacy")}</Link>
          <button onClick={openConsentSettings} type="button">
            {t("footer.privacySettings")}
          </button>
        </nav>
      </div>
    </footer>
  );
}
