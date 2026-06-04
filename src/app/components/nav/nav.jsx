"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {resources} from "../../../lib/i18n";
import {
  FALLBACK_LANGUAGE,
  MANUAL_LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from "../../../lib/languageDetection";
import {useCookieConsent} from "../consent/CookieConsent";
import {usePublicSettings} from "../public-settings/PublicSettingsProvider";
import ThemeToggle from "../theme/ThemeToggle";
import "./nav.component.css";

const navLinks = [
  {href: "/#executiveSummary", labelKey: "nav.executiveSummary"},
  {href: "/#about", labelKey: "nav.about"},
  {href: "/#skills", labelKey: "nav.impact"},
  {href: "/#timeline", labelKey: "nav.timeline"},
  {href: "/#cv", labelKey: "nav.cv"},
  {href: "/#blog", labelKey: "nav.blog", section: "blog"},
  {href: "/#portfolio", labelKey: "nav.portfolio"},
  {href: "/#persoenlich", labelKey: "nav.personal"},
  {href: "/#contact", labelKey: "nav.contact"},
];

const supportedLanguages = Object.keys(resources);
const DEFAULT_LOGO_URL = "/logo.svg";

function getSupportedLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);
  return supportedLanguages.includes(normalizedLanguage)
    ? normalizedLanguage
    : null;
}

function getStoredLanguage() {
  if (typeof window === "undefined") return null;

  try {
    return getSupportedLanguage(
      window.localStorage.getItem(MANUAL_LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function getQueryLanguage() {
  if (typeof window === "undefined") return null;

  try {
    const searchParams = new URLSearchParams(window.location.search);
    return getSupportedLanguage(
      searchParams.get("lng") || searchParams.get("language"),
    );
  } catch {
    return null;
  }
}

function storeLanguage(language) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(MANUAL_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // Ignore unavailable storage and still switch for the current session.
  }

  try {
    window.document.cookie = `${MANUAL_LANGUAGE_STORAGE_KEY}=${encodeURIComponent(
      language,
    )}; Path=/; Max-Age=31536000; SameSite=Lax`;
  } catch {
    // Ignore unavailable cookies and still switch for the current session.
  }
}

const NavBar = () => {
  const router = useRouter();
  const {t, i18n} = useTranslation();
  const {allowExternalServices} = useCookieConsent();
  const {blogEnabled, siteMetadata} = usePublicSettings();

  const [menuOpen, setMenuOpen] = useState(false);

  const [lang, setLang] = useState(
    () =>
      getSupportedLanguage(i18n.resolvedLanguage || i18n.language) ||
      FALLBACK_LANGUAGE,
  );

  useEffect(() => {
    const syncLanguage = (language) => {
      const nextLanguage = getSupportedLanguage(language) || FALLBACK_LANGUAGE;
      setLang(nextLanguage);

      if (typeof document !== "undefined") {
        document.documentElement.lang = nextLanguage;
      }
    };

    syncLanguage(i18n.resolvedLanguage || i18n.language);
    i18n.on("languageChanged", syncLanguage);

    return () => {
      i18n.off("languageChanged", syncLanguage);
    };
  }, [i18n]);

  useEffect(() => {
    const preferredLanguage = getQueryLanguage() || getStoredLanguage();
    if (preferredLanguage) {
      if (preferredLanguage !== getSupportedLanguage(i18n.language)) {
        void i18n.changeLanguage(preferredLanguage);
      }
      return undefined;
    }

    if (!allowExternalServices) return undefined;

    const controller = new AbortController();

    async function detectLanguage() {
      try {
        const response = await fetch("/api/language", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok || getStoredLanguage()) return;

        const data = await response.json();
        const detectedLanguage = getSupportedLanguage(data?.language);

        if (
          detectedLanguage &&
          detectedLanguage !== getSupportedLanguage(i18n.language)
        ) {
          void i18n.changeLanguage(detectedLanguage);
        }
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.warn("Unable to auto-detect language", error);
        }
      }
    }

    void detectLanguage();

    return () => {
      controller.abort();
    };
  }, [allowExternalServices, i18n]);

  useEffect(() => {
    if (typeof document === "undefined" || !menuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);

  const visibleNavLinks = useMemo(
    () =>
      navLinks.filter((link) => link.section !== "blog" || blogEnabled === true),
    [blogEnabled],
  );

  const syncBlogRouteLanguage = (language) => {
    if (typeof window === "undefined") return;

    const {hash, pathname, search} = window.location;

    if (!pathname.startsWith("/blog/")) return;

    const searchParams = new URLSearchParams(search);
    searchParams.set("lng", language);

    const nextUrl = `${pathname}?${searchParams.toString()}${hash || ""}`;
    const currentUrl = `${pathname}${search}${hash || ""}`;

    if (nextUrl !== currentUrl) {
      router.replace(nextUrl, {scroll: false});
    }
  };

  const selectLanguage = (language) => {
    const supportedLanguage = getSupportedLanguage(language);

    if (!supportedLanguage) return;

    storeLanguage(supportedLanguage);
    setLang(supportedLanguage);
    void i18n.changeLanguage(supportedLanguage);
    syncBlogRouteLanguage(supportedLanguage);
  };

  return (
    <div className="topBar">
      {/* Logo / back-to-top anchor */}
      <div className="kicker">
        <Link href="/#top" onClick={closeMenu} aria-label="Back to top">
          <img
            src={siteMetadata.logoUrl || DEFAULT_LOGO_URL}
            alt={siteMetadata.title ? `${siteMetadata.title} logo` : "Site logo"}
            width="60"
            height="60"
            className="logo"
          />
        </Link>
      </div>

      {/* Primary nav links */}
      <nav className={`nav ${menuOpen ? "navOpen" : ""}`}>
        {visibleNavLinks.map(({href, labelKey}) => (
          <Link key={href} href={href} onClick={closeMenu}>
            {t(labelKey)}
          </Link>
        ))}
        {/* Language switcher inside mobile menu */}
        <div className="navLangSwitch">
          {supportedLanguages.map((code) => (
            <button
              key={code}
              onClick={() => {
                selectLanguage(code);
                closeMenu();
              }}
              className={`langButton ${lang === code ? "langActive" : ""}`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>

      <div className="topControls">
        <ThemeToggle className="navThemeToggle" />

        {/* Hamburger Button (Mobile Menu) */}
        <button
          className={`menuToggle ${menuOpen ? "menuOpen" : ""}`}
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          <span />
          <span />
          <span />
        </button>

        {/* Language switcher on desktop */}
        <div className="langSwitch">
          {supportedLanguages.map((code) => (
            <button
              key={code}
              onClick={() => selectLanguage(code)}
              className={`langButton ${lang === code ? "langActive" : ""}`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NavBar;
