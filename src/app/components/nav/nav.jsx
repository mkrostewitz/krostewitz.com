import Image from "next/image";
import {useTranslation} from "react-i18next";
import {resources} from "../../../lib/i18n";
import {useEffect, useState} from "react";
import "./nav.component.css";

const NavBar = () => {
  const [lang, setLang] = useState("en");
  const [menuOpen, setMenuOpen] = useState(false);
  const {t, i18n} = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="topBar">
      <div className="kicker">
        <Image
          src="/logo.svg"
          alt="MK logo"
          width={60}
          height={60}
          className="logo"
          priority
        />
      </div>
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
      <nav className={`nav ${menuOpen ? "navOpen" : ""}`}>
        <a href="#about" onClick={closeMenu}>
          {t("nav.about")}
        </a>
        <a href="#timeline" onClick={closeMenu}>
          {t("nav.timeline")}
        </a>
        <a href="#executiveSummary" onClick={closeMenu}>
          {t("nav.executiveSummary")}
        </a>
        <a href="#map" onClick={closeMenu}>
          {t("nav.map")}
        </a>
        <a href="#cv" onClick={closeMenu}>
          {t("nav.cv")}
        </a>
        <a href="#contact" onClick={closeMenu}>
          {t("nav.contact")}
        </a>
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
