import Image from "next/image";
import {useTranslation} from "react-i18next";
import {resources} from "../../../lib/i18n";
import {useEffect, useRef, useState} from "react";
import "./nav.component.css";

const NavBar = () => {
  const {t, i18n} = useTranslation();

  const [menuOpen, setMenuOpen] = useState(false);

  // Track currently selected language (defaults to what i18n resolved, else English)
  const [lang, setLang] = useState(
    () => i18n.resolvedLanguage || i18n.language || "en"
  );
  const supported = Object.keys(resources);
  const autoDetected = useRef(false);

  // After hydration, detect browser language once; don't override manual choice
  useEffect(() => {
    if (autoDetected.current || typeof navigator === "undefined") return;
    const browserLang = navigator.language?.split("-")[0];
    if (
      browserLang &&
      supported.includes(browserLang) &&
      browserLang !== lang
    ) {
      setLang(browserLang);
    }
    autoDetected.current = true;
  }, [lang, supported]);

  useEffect(() => {
    if (lang && lang !== i18n.language) {
      console.log("Setting language to", lang);
      i18n.changeLanguage(lang);
    }
  }, [lang, i18n]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="topBar">
      {/* Logo / back-to-top anchor */}
      <div className="kicker">
        <a href="#top" onClick={closeMenu} aria-label="Back to top">
          <Image
            src="/logo.svg"
            alt="MK logo"
            width={60}
            height={60}
            className="logo"
            priority
          />
        </a>
      </div>

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

      {/* Primary nav links */}
      <nav className={`nav ${menuOpen ? "navOpen" : ""}`}>
        <a href="#executiveSummary" onClick={closeMenu}>
          {t("nav.executiveSummary")}
        </a>
        <a href="#about" onClick={closeMenu}>
          {t("nav.about")}
        </a>
        <a href="#skills" onClick={closeMenu}>
          {t("nav.impact")}
        </a>

        <a href="#timeline" onClick={closeMenu}>
          {t("nav.timeline")}
        </a>
        <a href="#cv" onClick={closeMenu}>
          {t("nav.cv")}
        </a>
        <a href="#contact" onClick={closeMenu}>
          {t("nav.contact")}
        </a>
        {/* Language switcher inside mobile menu */}
        <div className="navLangSwitch">
          {Object.keys(resources).map((code) => (
            <button
              key={code}
              onClick={() => {
                setLang(code);
                closeMenu();
              }}
              className={`langButton ${lang === code ? "langActive" : ""}`}
            >
              {code.toUpperCase()}
            </button>
          ))}
        </div>
      </nav>
      {/* Language switcher on desktop */}
      <div className="langSwitch">
        {Object.keys(resources).map((code) => (
          <button
            key={code}
            onClick={() => setLang(code)}
            className={`langButton ${lang === code ? "langActive" : ""}`}
          >
            {code.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

export default NavBar;
