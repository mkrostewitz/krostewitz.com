import Image from "next/image";
import {useTranslation} from "react-i18next";
import {resources} from "../../../lib/i18n";
import {useEffect, useState} from "react";
import "./nav.component.css";

const NavBar = () => {
  const [lang, setLang] = useState("en");
  const {t, i18n} = useTranslation();

  useEffect(() => {
    i18n.changeLanguage(lang);
  }, [lang]);

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
      <nav className="nav">
        <a href="#about">{t("nav.about")}</a>
        <a href="#timeline">{t("nav.timeline")}</a>
        <a href="#executiveSummary">{t("nav.executiveSummary")}</a>
        <a href="#map">{t("nav.map")}</a>
        <a href="#contact">{t("nav.contact")}</a>
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
