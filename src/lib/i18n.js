/* global module */

import i18n from "i18next";
import {initReactI18next} from "react-i18next";

import {FALLBACK_LANGUAGE} from "./languageDetection";
import {resources} from "./translationResources";

export {resources};

const isBrowser = typeof window !== "undefined";
const isDevelopment = process.env.NODE_ENV === "development";

function syncResourceBundles(resourceSet = resources) {
  Object.entries(resourceSet).forEach(([language, namespaces]) => {
    Object.entries(namespaces).forEach(([namespace, resource]) => {
      i18n.addResourceBundle(language, namespace, resource, true, true);
    });
  });
}

function notifyTranslationsChanged(resourceSet = resources) {
  const language = i18n.resolvedLanguage || i18n.language || "en";

  i18n.emit("loaded", resourceSet);
  i18n.emit("languageChanged", language);
}

export async function loadRuntimeTranslations() {
  if (!isBrowser) return;

  try {
    const response = await fetch("/api/content/translations");

    if (!response.ok) return;

    const data = await response.json();
    if (!data?.resources) return;

    syncResourceBundles(data.resources);
    notifyTranslationsChanged(data.resources);
  } catch (error) {
    if (isDevelopment) {
      console.warn("Unable to load runtime translations", error);
    }
  }
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: ["en", "de"],
    nonExplicitSupportedLngs: true,
    interpolation: {escapeValue: false},
    react: {
      bindI18n: "languageChanged loaded",
      bindI18nStore: "added removed",
    },
  });
} else {
  syncResourceBundles();

  if (isBrowser && isDevelopment) {
    notifyTranslationsChanged();
  }
}

if (
  isBrowser &&
  isDevelopment &&
  typeof module !== "undefined" &&
  module.hot
) {
  module.hot.accept();
  module.hot.accept(["./translationResources"], () => {
    syncResourceBundles();
    notifyTranslationsChanged();
  });
}

export default i18n;
