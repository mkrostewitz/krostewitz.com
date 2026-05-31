import {
  FALLBACK_LANGUAGE,
  MANUAL_LANGUAGE_STORAGE_KEY,
  normalizeLanguage,
} from "./languageDetection";
import {supportedLanguages} from "./translationResources";

export const LANGUAGE_COOKIE_NAME = MANUAL_LANGUAGE_STORAGE_KEY;

const LANGUAGE_LABELS = {
  en: "English",
  de: "German",
};

export const SITE_LANGUAGES = supportedLanguages.map((code) => ({
  code,
  label: LANGUAGE_LABELS[code] || code.toUpperCase(),
}));

export const SITE_LANGUAGE_CODES = SITE_LANGUAGES.map((language) => language.code);

export function getSupportedSiteLanguage(language) {
  const normalizedLanguage = normalizeLanguage(language);
  return SITE_LANGUAGE_CODES.includes(normalizedLanguage)
    ? normalizedLanguage
    : null;
}

export function getSiteLanguageLabel(language) {
  const supportedLanguage = getSupportedSiteLanguage(language) || FALLBACK_LANGUAGE;
  return (
    SITE_LANGUAGES.find((item) => item.code === supportedLanguage)?.label ||
    supportedLanguage.toUpperCase()
  );
}
