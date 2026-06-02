"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {useTranslation} from "react-i18next";

import "../../../lib/i18n";
import styles from "./cookie-consent.module.css";

export const OPEN_CONSENT_EVENT = "site:open-cookie-consent";

const CONSENT_STORAGE_KEY =
  process.env.NEXT_PUBLIC_CONSENT_STORAGE_KEY?.trim() ||
  "site-consent-preferences";
const CONSENT_VERSION = 1;

const DEFAULT_CONSENT = {
  analytics: false,
  externalServices: false,
  necessary: true,
};

function getDefaultDraftConsent(analyticsAvailable) {
  return {
    analytics: Boolean(analyticsAvailable),
    externalServices: true,
    necessary: true,
  };
}

const CookieConsentContext = createContext({
  allowAnalytics: false,
  allowExternalServices: false,
  consent: DEFAULT_CONSENT,
  hasDecision: false,
  openConsentSettings: () => {},
  updateConsent: () => {},
});

function normalizeConsent(value, analyticsAvailable) {
  return {
    analytics: Boolean(analyticsAvailable && value?.analytics),
    externalServices: Boolean(value?.externalServices),
    necessary: true,
  };
}

function readStoredConsent(analyticsAvailable) {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed?.version !== CONSENT_VERSION) return null;

    return normalizeConsent(parsed.categories, analyticsAvailable);
  } catch {
    return null;
  }
}

function writeStoredConsent(consent) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({
        categories: consent,
        updatedAt: new Date().toISOString(),
        version: CONSENT_VERSION,
      }),
    );
  } catch {
    // Consent remains active for the current page view if storage is unavailable.
  }
}

function getAnalyticsCookieNames(measurementId) {
  if (typeof document === "undefined") return [];

  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim())
    .filter(Boolean);
  const suffix = String(measurementId || "")
    .trim()
    .replace(/^G-/i, "")
    .replace(/[^A-Za-z0-9_]/g, "");

  return Array.from(
    new Set([
      "_ga",
      "_gid",
      "_gat",
      suffix ? `_ga_${suffix}` : "",
      ...names.filter(
        (name) =>
          name === "_ga" ||
          name === "_gid" ||
          name === "_gat" ||
          name.startsWith("_ga_") ||
          name.startsWith("_gac_") ||
          name.startsWith("_gcl_"),
      ),
    ]),
  ).filter(Boolean);
}

function getCookieDomainAttributes() {
  if (typeof window === "undefined") return [""];

  const hostname = window.location.hostname;
  if (!hostname || hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
    return [""];
  }

  const parts = hostname.split(".");
  const domains = [hostname];
  for (let index = 1; index < parts.length - 1; index += 1) {
    domains.push(`.${parts.slice(index).join(".")}`);
  }
  domains.push(`.${hostname}`);

  return ["", ...Array.from(new Set(domains)).map((domain) => `; Domain=${domain}`)];
}

function deleteGoogleAnalyticsCookies(measurementId) {
  if (typeof document === "undefined") return;

  const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
  const domains = getCookieDomainAttributes();

  getAnalyticsCookieNames(measurementId).forEach((name) => {
    domains.forEach((domain) => {
      document.cookie = `${name}=; Expires=${expires}; Max-Age=0; Path=/${domain}; SameSite=Lax`;
    });
  });
}

function ensureGtag() {
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    function gtag() {
      window.dataLayer.push(arguments);
    };
}

function loadGoogleAnalytics(measurementId) {
  if (!measurementId || typeof window === "undefined") return;

  window[`ga-disable-${measurementId}`] = false;
  ensureGtag();
  window.gtag("consent", "update", {analytics_storage: "granted"});

  if (!window.__siteConsentGaInitialized) {
    window.gtag("js", new Date());
    window.__siteConsentGaInitialized = true;
  }

  window.__siteConsentGaConfiguredIds =
    window.__siteConsentGaConfiguredIds || {};

  if (!window.__siteConsentGaConfiguredIds[measurementId]) {
    window.gtag("config", measurementId, {
      anonymize_ip: true,
    });
    window.__siteConsentGaConfiguredIds[measurementId] = true;
  }

  if (!document.getElementById("site-google-analytics")) {
    const script = document.createElement("script");
    script.async = true;
    script.id = "site-google-analytics";
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(
      measurementId,
    )}`;
    document.head.appendChild(script);
  }
}

function disableGoogleAnalytics(measurementId) {
  if (!measurementId || typeof window === "undefined") return;

  window[`ga-disable-${measurementId}`] = true;
  if (typeof window.gtag === "function") {
    window.gtag("consent", "update", {analytics_storage: "denied"});
  }
  deleteGoogleAnalyticsCookies(measurementId);
}

function ToggleRow({
  checked,
  children,
  disabled = false,
  label,
  meta,
  onChange,
}) {
  return (
    <label className={styles.category} data-disabled={disabled || undefined}>
      <span className={styles.categoryCopy}>
        <span className={styles.categoryTitle}>{label}</span>
        <span className={styles.categoryText}>{children}</span>
        {meta ? <span className={styles.categoryMeta}>{meta}</span> : null}
      </span>
      <span className={styles.switch} aria-hidden>
        <input
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          type="checkbox"
        />
        <span />
      </span>
    </label>
  );
}

export function CookieConsentProvider({children, gaMeasurementId = ""}) {
  const {t} = useTranslation();
  const pathname = usePathname();
  const analyticsAvailable = Boolean(String(gaMeasurementId || "").trim());
  const isAdminPath = pathname?.startsWith("/admin");
  const [isReady, setIsReady] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasDecision, setHasDecision] = useState(false);
  const [consent, setConsent] = useState(DEFAULT_CONSENT);
  const [draft, setDraft] = useState(DEFAULT_CONSENT);

  const applyConsent = useCallback(
    (nextConsent) => {
      const normalized = normalizeConsent(nextConsent, analyticsAvailable);
      writeStoredConsent(normalized);
      setConsent(normalized);
      setDraft(normalized);
      setHasDecision(true);
      setIsOpen(false);

      window.dispatchEvent(
        new CustomEvent("site:cookie-consent-changed", {
          detail: normalized,
        }),
      );
    },
    [analyticsAvailable],
  );

  const openConsentSettings = useCallback(() => {
    setDraft(consent);
    setIsOpen(true);
  }, [consent]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      const storedConsent = readStoredConsent(analyticsAvailable);

      if (storedConsent) {
        setConsent(storedConsent);
        setDraft(storedConsent);
        setHasDecision(true);
        setIsOpen(false);
      } else {
        setConsent(DEFAULT_CONSENT);
        setDraft(getDefaultDraftConsent(analyticsAvailable));
        setHasDecision(false);
        setIsOpen(!isAdminPath);
      }

      setIsReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [analyticsAvailable, isAdminPath]);

  useEffect(() => {
    function handleOpenConsent() {
      setDraft(consent);
      setIsOpen(true);
    }

    window.addEventListener(OPEN_CONSENT_EVENT, handleOpenConsent);
    return () => {
      window.removeEventListener(OPEN_CONSENT_EVENT, handleOpenConsent);
    };
  }, [consent]);

  useEffect(() => {
    if (!isReady || isAdminPath) return;

    if (analyticsAvailable && consent.analytics) {
      loadGoogleAnalytics(gaMeasurementId);
    } else if (analyticsAvailable) {
      disableGoogleAnalytics(gaMeasurementId);
    }
  }, [
    analyticsAvailable,
    consent.analytics,
    gaMeasurementId,
    isAdminPath,
    isReady,
  ]);

  const showPanel = isReady && isOpen && !isAdminPath;

  useEffect(() => {
    if (!showPanel) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showPanel]);

  const value = useMemo(
    () => ({
      allowAnalytics: Boolean(analyticsAvailable && consent.analytics),
      allowExternalServices: Boolean(consent.externalServices),
      consent,
      hasDecision,
      openConsentSettings,
      updateConsent: applyConsent,
    }),
    [
      analyticsAvailable,
      applyConsent,
      consent,
      hasDecision,
      openConsentSettings,
    ],
  );

  const isInitialBanner = !hasDecision;

  return (
    <CookieConsentContext.Provider value={value}>
      {children}
      {showPanel ? (
        <div
          className={styles.root}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cookie-consent-title"
        >
          <div className={styles.panel}>
            <div className={styles.header}>
              <div>
                <p className={styles.eyebrow}>{t("cookieConsent.eyebrow")}</p>
                <h2 id="cookie-consent-title">{t("cookieConsent.title")}</h2>
              </div>
              {!isInitialBanner ? (
                <button
                  className={styles.closeButton}
                  onClick={() => setIsOpen(false)}
                  type="button"
                >
                  {t("cookieConsent.actions.close")}
                </button>
              ) : null}
            </div>

            <p className={styles.intro}>{t("cookieConsent.intro")}</p>

            <div className={styles.categories}>
              <ToggleRow
                checked
                disabled
                label={t("cookieConsent.categories.necessary.title")}
                meta={t("cookieConsent.alwaysActive")}
              >
                {t("cookieConsent.categories.necessary.description")}
              </ToggleRow>

              {analyticsAvailable ? (
                <ToggleRow
                  checked={draft.analytics}
                  label={t("cookieConsent.categories.analytics.title")}
                  onChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      analytics: checked,
                    }))
                  }
                >
                  {t("cookieConsent.categories.analytics.description")}
                </ToggleRow>
              ) : null}

              <ToggleRow
                checked={draft.externalServices}
                label={t("cookieConsent.categories.externalServices.title")}
                onChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    externalServices: checked,
                  }))
                }
              >
                {t("cookieConsent.categories.externalServices.description")}
              </ToggleRow>
            </div>

            <div className={styles.footer}>
              <Link href="/privacy" className={styles.privacyLink}>
                {t("cookieConsent.privacyLink")}
              </Link>
              <div className={styles.actions}>
                <button
                  className={styles.button}
                  onClick={() => applyConsent(draft)}
                  type="button"
                >
                  {t("cookieConsent.actions.save")}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </CookieConsentContext.Provider>
  );
}

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}
