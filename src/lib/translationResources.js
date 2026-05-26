import deTranslation from "../locales/de/translation.json";
import enTranslation from "../locales/en/translation.json";

export const resources = {
  en: {
    translation: enTranslation,
  },
  de: {
    translation: deTranslation,
  },
};

export const supportedLanguages = Object.keys(resources);

export function buildResourcesFromTranslations(translations = {}) {
  return supportedLanguages.reduce((acc, language) => {
    acc[language] = {
      translation: translations[language] || resources[language].translation,
    };
    return acc;
  }, {});
}
