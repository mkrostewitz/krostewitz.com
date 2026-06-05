"use client";

import {usePathname} from "next/navigation";
import {useEffect} from "react";
import {useTranslation} from "react-i18next";

import {
  FALLBACK_LANGUAGE,
  MANUAL_LANGUAGE_STORAGE_KEY,
} from "../../../lib/languageDetection";
import {getSupportedSiteLanguage} from "../../../lib/siteLanguages";
import {useCookieConsent} from "../consent/CookieConsent";

export const AI_CHAT_LANGUAGE_EVENT = "site:language-changed";

function copyScriptAttributes(source, target) {
  for (const attribute of source.attributes) {
    target.setAttribute(attribute.name, attribute.value);
  }
}

function publishLanguage(language) {
  window.__siteLanguage = language;
  document
    .querySelectorAll('script[data-site-ai-chat="true"]')
    .forEach((script) => {
      script.dataset.lang = language;
    });
  window.dispatchEvent(
    new CustomEvent(AI_CHAT_LANGUAGE_EVENT, {
      detail: {language},
    }),
  );
}

function getQueryLanguage() {
  try {
    const searchParams = new URLSearchParams(window.location.search);
    return getSupportedSiteLanguage(
      searchParams.get("lng") || searchParams.get("language"),
    );
  } catch {
    return null;
  }
}

function getStoredLanguage() {
  try {
    return getSupportedSiteLanguage(
      window.localStorage.getItem(MANUAL_LANGUAGE_STORAGE_KEY),
    );
  } catch {
    return null;
  }
}

function getCookieLanguage() {
  try {
    const cookies = document.cookie
      .split(";")
      .map((cookie) => cookie.trim())
      .filter(Boolean);
    const prefix = `${MANUAL_LANGUAGE_STORAGE_KEY}=`;
    const languageCookie = cookies.find((cookie) => cookie.startsWith(prefix));

    return getSupportedSiteLanguage(
      languageCookie
        ? decodeURIComponent(languageCookie.slice(prefix.length))
        : "",
    );
  } catch {
    return null;
  }
}

function getI18nLanguage(i18n) {
  return getSupportedSiteLanguage(i18n.resolvedLanguage || i18n.language);
}

function getSnippetLanguage(scriptTag) {
  try {
    const template = document.createElement("template");
    template.innerHTML = scriptTag;
    const script = template.content.querySelector("script");

    return getSupportedSiteLanguage(script?.dataset.lang);
  } catch {
    return null;
  }
}

function getCurrentSiteLanguage(i18n, scriptTag) {
  return (
    getQueryLanguage() ||
    getStoredLanguage() ||
    getCookieLanguage() ||
    getSnippetLanguage(scriptTag) ||
    getI18nLanguage(i18n) ||
    FALLBACK_LANGUAGE
  );
}

function createExecutableScript(source, language) {
  const script = document.createElement("script");

  copyScriptAttributes(source, script);
  script.dataset.lang = language;
  script.dataset.siteAiChat = "true";
  script.text = source.textContent || "";

  return script;
}

function removeInjectedChat(injectedScripts = []) {
  for (const script of injectedScripts) {
    script.remove();
  }

  document.querySelectorAll(".chat-widget-shell").forEach((element) => {
    element.remove();
  });
}

export default function AiChatScriptLoader({enabled, scriptTag}) {
  const pathname = usePathname();
  const {i18n} = useTranslation();
  const {allowExternalServices, hasDecision} = useCookieConsent();
  const isAdminPath = pathname?.startsWith("/admin") || false;
  const language = getCurrentSiteLanguage(i18n, scriptTag);

  useEffect(() => {
    publishLanguage(language);
  }, [language]);

  useEffect(() => {
    if (
      !enabled ||
      !scriptTag ||
      isAdminPath ||
      !hasDecision ||
      !allowExternalServices
    ) {
      return undefined;
    }

    const template = document.createElement("template");
    template.innerHTML = scriptTag;

    const scripts = Array.from(template.content.querySelectorAll("script"));
    if (!scripts.length) return undefined;

    const injectedScripts = scripts.map((source) => {
      const script = createExecutableScript(source, language);
      document.body.appendChild(script);
      return script;
    });

    return () => {
      removeInjectedChat(injectedScripts);
    };
  }, [
    allowExternalServices,
    enabled,
    hasDecision,
    isAdminPath,
    language,
    scriptTag,
  ]);

  return null;
}
