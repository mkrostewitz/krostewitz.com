"use client";

import {Moon, Sun} from "lucide-react";
import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import "../../../lib/i18n";
import "./theme-toggle.css";

const THEME_STORAGE_KEY = "krostewitz-theme";
const THEME_CHANGE_EVENT = "krostewitz-theme-change";

function isTheme(value) {
  return value === "light" || value === "dark";
}

function getSystemTheme() {
  if (typeof window === "undefined") return "light";

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getStoredTheme() {
  if (typeof window === "undefined") return null;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(storedTheme) ? storedTheme : null;
  } catch {
    return null;
  }
}

function getCurrentTheme() {
  if (typeof document === "undefined") return "light";

  const documentTheme = document.documentElement.dataset.theme;
  return isTheme(documentTheme) ? documentTheme : getStoredTheme() || getSystemTheme();
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export default function ThemeToggle({className = ""}) {
  const {t} = useTranslation();
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    const syncTheme = (nextTheme = getCurrentTheme()) => {
      applyTheme(nextTheme);
      setTheme(nextTheme);
    };

    syncTheme();

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemTheme = (event) => {
      if (!getStoredTheme()) {
        syncTheme(event.matches ? "dark" : "light");
      }
    };
    const handleThemeChange = (event) => {
      if (isTheme(event.detail)) {
        syncTheme(event.detail);
      }
    };
    const handleStorage = (event) => {
      if (event.key === THEME_STORAGE_KEY) {
        syncTheme(isTheme(event.newValue) ? event.newValue : getSystemTheme());
      }
    };

    mediaQuery.addEventListener("change", handleSystemTheme);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemTheme);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const nextTheme = theme === "dark" ? "light" : "dark";
  const label = t(`theme.${theme}`);
  const nextThemeLabel = t(`theme.${nextTheme}`);
  const switchLabel = t(`theme.switchTo.${nextTheme}`, {
    theme: nextThemeLabel,
  });

  const toggleTheme = () => {
    applyTheme(nextTheme);
    setTheme(nextTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The in-page theme still changes when storage is unavailable.
    }

    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, {detail: nextTheme}));
  };

  return (
    <button
      type="button"
      className={`themeToggle ${className}`.trim()}
      onClick={toggleTheme}
      aria-label={switchLabel}
      aria-pressed={theme === "dark"}
      title={switchLabel}
    >
      {theme === "dark" ? (
        <Moon
          aria-hidden="true"
          className="themeToggleIcon"
          strokeWidth={2.2}
        />
      ) : (
        <Sun
          aria-hidden="true"
          className="themeToggleIcon"
          strokeWidth={2.2}
        />
      )}
      <span className="themeToggleText">{label}</span>
    </button>
  );
}
