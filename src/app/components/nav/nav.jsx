"use client";

import Image from "next/image";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {resources} from "../../../lib/i18n";
import {
  FALLBACK_LANGUAGE,
  MANUAL_LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from "../../../lib/languageDetection";
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
}

const NavBar = () => {
  const {t, i18n} = useTranslation();

  const [menuOpen, setMenuOpen] = useState(false);
  const [blogEnabled, setBlogEnabled] = useState(null);

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
  }, [i18n]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPublicSettings() {
      try {
        const response = await fetch("/api/content/profile", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load public settings.");
        }

        setBlogEnabled(data.profile?.blogEnabled !== false);
      } catch (error) {
        if (error?.name === "AbortError") return;
        setBlogEnabled(true);
      }
    }

    void loadPublicSettings();

    return () => {
      controller.abort();
    };
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const visibleNavLinks = useMemo(
    () =>
      navLinks.filter((link) => link.section !== "blog" || blogEnabled === true),
    [blogEnabled],
  );

  const selectLanguage = (language) => {
    storeLanguage(language);
    setLang(language);
    void i18n.changeLanguage(language);
  };

  return (
    <div className="topBar">
      {/* Logo / back-to-top anchor */}
      <div className="kicker">
        <Link href="/#top" onClick={closeMenu} aria-label="Back to top">
          <Image
            src="/logo.svg"
            alt="MK logo"
            width={60}
            height={60}
            className="logo"
            priority
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
