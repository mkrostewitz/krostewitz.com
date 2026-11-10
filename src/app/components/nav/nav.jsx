"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {usePathname, useRouter} from "next/navigation";
import {useEffect, useMemo, useRef, useState} from "react";
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
  {href: "/#about", labelKey: "nav.about"},
  {href: "/#executiveSummary", labelKey: "nav.executiveSummary"},
  {href: "/#skills", labelKey: "nav.impact", section: "skills"},
  {href: "/#timeline", labelKey: "nav.timeline"},
  {href: "/#references", labelKey: "nav.references", section: "references"},
  {href: "/#blog", labelKey: "nav.blog", section: "blog"},
  {href: "/#portfolio", labelKey: "nav.portfolio", section: "lab"},
  {href: "/#persoenlich", labelKey: "nav.personal", section: "personal"},
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
  const pathname = usePathname();
  const topBarRef = useRef(null);
  const {t, i18n} = useTranslation();
  const {allowExternalServices} = useCookieConsent();
  const {blogEnabled, labEnabled, personalEnabled, referencesAvailable, siteMetadata, skillsAvailable} = usePublicSettings();

  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHref, setActiveHref] = useState(null);

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
      navLinks.filter((link) => {
        if (link.section === "references") return referencesAvailable;
        if (link.section === "lab") return labEnabled === true;
        if (link.section === "personal") return personalEnabled === true;
        if (link.section === "blog") return blogEnabled === true;
        if (link.section === "skills") return skillsAvailable === true;
        return true;
      }),
    [blogEnabled, labEnabled, personalEnabled, referencesAvailable, skillsAvailable],
  );

  useEffect(() => {
    if (pathname !== "/") return undefined;

    let frame = 0;
    const updateActiveSection = () => {
      frame = 0;
      const sections = visibleNavLinks
        .map(({href}) => {
          const element = document.getElementById(href.slice(2));
          if (!element || !element.getClientRects().length) return null;
          return {href, top: element.getBoundingClientRect().top};
        })
        .filter(Boolean)
        .sort((a, b) => a.top - b.top);

      // Read below the fixed header, using page order rather than menu order.
      const readingLine = Math.max(
        (topBarRef.current?.getBoundingClientRect().bottom || 0) + 24,
        window.innerHeight * 0.25,
      );
      let current = null;
      for (const section of sections) {
        if (section.top > readingLine) break;
        current = section.href;
      }

      // Short final sections may never reach the reading line.
      if (
        window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      ) {
        current = sections.at(-1)?.href || null;
      }
      setActiveHref(current);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };

    window.addEventListener("scroll", scheduleUpdate, {passive: true});
    window.addEventListener("resize", scheduleUpdate);
    // Recheck after asynchronous content, images, or translations change layout.
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(document.body);
    if (topBarRef.current) resizeObserver.observe(topBarRef.current);
    scheduleUpdate();

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      resizeObserver.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [pathname, visibleNavLinks]);

  const syncRouteLanguage = (language) => {
    if (typeof window === "undefined") return;

    const {hash, pathname, search} = window.location;

    const searchParams = new URLSearchParams(search);
    if (!pathname.startsWith("/blog/") && !searchParams.has("lng") && !searchParams.has("language")) return;
    searchParams.delete("language");
    searchParams.set("lng", language);

    const nextUrl = `${pathname}?${searchParams.toString()}${hash || ""}`;
    const currentUrl = `${pathname}${search}${hash || ""}`;

    if (nextUrl !== currentUrl) {
      if (pathname.startsWith("/blog/")) router.replace(nextUrl, {scroll: false});
      else window.history.replaceState(null, "", nextUrl);
    }
  };

  const selectLanguage = (language) => {
    const supportedLanguage = getSupportedLanguage(language);

    if (!supportedLanguage) return;

    syncRouteLanguage(supportedLanguage);
    storeLanguage(supportedLanguage);
    setLang(supportedLanguage);
    void i18n.changeLanguage(supportedLanguage);
  };

  return (
    <div className="topBar" ref={topBarRef}>
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
          <Link
            key={href}
            href={href}
            onClick={closeMenu}
            aria-current={pathname === "/" && activeHref === href ? "location" : undefined}
          >
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
