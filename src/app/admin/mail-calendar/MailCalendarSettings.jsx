"use client";

import {Save, Send, Trash2} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import {loadRuntimeTranslations} from "../../../lib/i18n";
import {useLoadingState} from "../../components/loading/LoadingProvider";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const MAIL_PROVIDER_OPTIONS = [
  {value: "apple", label: "Apple iCloud Mail"},
  {value: "gmail", label: "Gmail"},
  {value: "microsoft", label: "Microsoft 365 / Outlook"},
  {value: "custom", label: "Custom SMTP"},
  {value: "disabled", label: "Disabled"},
];

const MAIL_PROVIDER_PRESETS = {
  apple: {
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  gmail: {
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  microsoft: {
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  custom: {
    host: "",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  disabled: {
    host: "",
    port: 587,
    secure: false,
    requireTLS: true,
  },
};

const EMPTY_PROFILE = {
  koalendar: {
    enabled: false,
    bookingUrl: "",
  },
  metadata: {
    title: "",
  },
  name: {
    firstName: "",
    lastName: "",
    fullName: "",
  },
  updatedAt: null,
};

const DEFAULT_MAIL_FORM = {
  provider: "apple",
  providerLabel: "Apple iCloud Mail",
  configured: false,
  enabled: true,
  active: false,
  host: "smtp.mail.me.com",
  port: 587,
  secure: false,
  requireTLS: true,
  timeoutMs: 10000,
  from: "",
  fromName: process.env.NEXT_PUBLIC_SITE_NAME || "Site",
  recipients: [],
  replyTo: "",
  username: "",
  passwordConfigured: false,
  smtpPassword: "",
  clearSmtpPassword: false,
  source: "database",
  missing: [],
  updatedAt: null,
  updatedBy: null,
};

function formatDate(value, locale, emptyLabel) {
  if (!value) return emptyLabel;

  return new Intl.DateTimeFormat(locale || "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeKoalendarForm(koalendar = {}) {
  return {
    enabled: koalendar.enabled !== false,
    bookingUrl: String(koalendar.bookingUrl || ""),
  };
}

function normalizeNameForm(name = {}) {
  return {
    firstName: String(name.firstName || "").trim(),
    lastName: String(name.lastName || "").trim(),
    fullName: String(name.fullName || "").trim(),
  };
}

function normalizeMailDraft(mail = {}) {
  return {
    ...DEFAULT_MAIL_FORM,
    ...(mail || {}),
    provider: String(mail?.provider || DEFAULT_MAIL_FORM.provider),
    port: Number(mail?.port || DEFAULT_MAIL_FORM.port),
    timeoutMs: Number(mail?.timeoutMs || DEFAULT_MAIL_FORM.timeoutMs),
    recipients: Array.isArray(mail?.recipients) ? mail.recipients : [],
    smtpPassword: String(mail?.smtpPassword || ""),
    clearSmtpPassword: Boolean(mail?.clearSmtpPassword),
    missing: Array.isArray(mail?.missing) ? mail.missing : [],
  };
}

function recipientsToText(recipients) {
  return Array.isArray(recipients) ? recipients.join(", ") : "";
}

function textToRecipients(value) {
  return String(value || "")
    .split(/[,\n;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

export default function MailCalendarSettings({user}) {
  const {t, i18n} = useTranslation(undefined, {keyPrefix: "admin.profile"});
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  const notSavedLabel = t("status.notSaved");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [koalendarForm, setKoalendarForm] = useState(() =>
    normalizeKoalendarForm(EMPTY_PROFILE.koalendar)
  );
  const [mailForm, setMailForm] = useState(() => normalizeMailDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingKoalendar, setIsSavingKoalendar] = useState(false);
  const [isSavingMail, setIsSavingMail] = useState(false);
  const [isTestingMail, setIsTestingMail] = useState(false);
  const mail = normalizeMailDraft(mailForm);
  const mailEditable = mail.provider !== "disabled";
  const mailEnabled = mail.enabled !== false && mailEditable;
  const mailStatus = mail.active
    ? "Ready"
    : !mailEnabled
      ? "Disabled"
      : "Needs config";
  const mailStatusClass = mail.active
    ? styles.statusBadgeSuccess
    : mailEnabled
      ? styles.statusBadgeWarning
      : "";
  const mailMissing = Array.isArray(mail.missing) ? mail.missing : [];
  const koalendarBookingUrl = koalendarForm.bookingUrl.trim();
  const koalendarCanOpen = /^https:\/\/([^/]+\.)*koalendar\.com(\/|$)/i.test(
    koalendarBookingUrl
  );
  const koalendarConnected = koalendarForm.enabled && koalendarCanOpen;
  const profileTranslationValues = useMemo(() => {
    const name = normalizeNameForm(profile.name);
    const firstName = name.firstName || t("fields.firstName");
    const lastName = name.lastName || t("fields.lastName");
    const profileName =
      name.fullName ||
      [name.firstName, name.lastName].filter(Boolean).join(" ") ||
      profile.metadata?.title ||
      [firstName, lastName].filter(Boolean).join(" ");

    return {firstName, lastName, profileName};
  }, [profile.metadata?.title, profile.name, t]);

  useLoadingState({
    isLoading,
    label: t("status.loading"),
    type: "page",
  });
  useLoadingState({
    isLoading: isSavingMail || isSavingKoalendar,
    label: t("actions.saving"),
    type: "action",
  });
  useLoadingState({
    isLoading: isTestingMail,
    label: "Sending test email...",
    type: "action",
  });

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [profileResponse, mailResponse] = await Promise.all([
          fetch("/api/admin/profile", {cache: "no-store"}),
          fetch("/api/admin/mail-settings", {cache: "no-store"}),
        ]);
        const [profileData, mailData] = await Promise.all([
          profileResponse.json().catch(() => ({})),
          mailResponse.json().catch(() => ({})),
        ]);

        if (!profileResponse.ok) {
          throw new Error(profileData.error || t("errors.loadProfile"));
        }

        if (!mailResponse.ok) {
          throw new Error(mailData.error || "Unable to load mail settings.");
        }

        const nextProfile = profileData.profile || EMPTY_PROFILE;

        if (!cancelled) {
          setProfile(nextProfile);
          setKoalendarForm(normalizeKoalendarForm(nextProfile.koalendar));
          setMailForm(normalizeMailDraft(mailData.settings));
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) {
          showSnackbar({
            type: "error",
            message: error.message || t("errors.loadProfile"),
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar, t]);

  function handleKoalendarInput(field, value) {
    setKoalendarForm((current) => ({...current, [field]: value}));
  }

  function setMailField(field, value) {
    setMailForm((current) => ({
      ...normalizeMailDraft(current),
      [field]: value,
    }));
  }

  function selectMailProvider(provider) {
    const preset = MAIL_PROVIDER_PRESETS[provider] || MAIL_PROVIDER_PRESETS.custom;

    setMailForm((current) => {
      const currentMail = normalizeMailDraft(current);

      return {
        ...currentMail,
        provider,
        enabled: provider === "disabled" ? false : currentMail.enabled !== false,
        host: preset.host,
        port: preset.port,
        secure: preset.secure,
        requireTLS: preset.requireTLS,
      };
    });
  }

  function clearMailSettings() {
    setMailForm({
      ...DEFAULT_MAIL_FORM,
      provider: "disabled",
      providerLabel: "Disabled",
      enabled: false,
      active: false,
      configured: false,
      host: "",
      fromName: "",
      smtpPassword: "",
      clearSmtpPassword: true,
      passwordConfigured: false,
      source: "database",
      missing: [],
    });
  }

  async function saveMailSettings({silent = false, showErrors = true} = {}) {
    setIsSavingMail(true);
    closeSnackbar();

    try {
      const data = await fetchJson("/api/admin/mail-settings", {
        method: "PUT",
        body: JSON.stringify({mail: normalizeMailDraft(mailForm)}),
      });

      setMailForm(normalizeMailDraft(data.settings));
      if (!silent) {
        showSnackbar({
          type: "success",
          message: "Mail settings saved.",
        });
      }
      return data.settings;
    } catch (error) {
      if (showErrors) {
        showSnackbar({
          type: "error",
          message: error.message || "Unable to save mail settings.",
        });
      }
      throw error;
    } finally {
      setIsSavingMail(false);
    }
  }

  async function sendTestEmail() {
    setIsTestingMail(true);
    closeSnackbar();

    try {
      const savedSettings = await saveMailSettings({
        silent: true,
        showErrors: false,
      });
      setMailForm(normalizeMailDraft(savedSettings));

      const result = await fetchJson("/api/admin/mail-settings/test", {
        method: "POST",
        body: JSON.stringify({}),
      });
      const accepted = Array.isArray(result.accepted) ? result.accepted.length : 0;

      showSnackbar({
        type: "success",
        message: accepted
          ? `Test email sent to ${accepted} recipient${accepted === 1 ? "" : "s"}.`
          : "Test email sent.",
      });
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message || "Unable to send test email.",
      });
    } finally {
      setIsTestingMail(false);
    }
  }

  async function saveKoalendarIntegration() {
    setIsSavingKoalendar(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({koalendar: koalendarForm}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("errors.saveKoalendar"));
      }

      const nextProfile = data.profile || EMPTY_PROFILE;

      setProfile(nextProfile);
      setKoalendarForm(normalizeKoalendarForm(nextProfile.koalendar));
      showSnackbar({
        type: "success",
        message: t("status.koalendarSaved"),
      });
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message || t("errors.saveKoalendar"),
      });
    } finally {
      setIsSavingKoalendar(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="mailCalendar" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Mail & Calendar Settings</h1>
            <p className={styles.muted}>
              Manage email delivery, SMTP testing, and public scheduling.
            </p>
          </div>
        </div>

        <div className={styles.settingsGrid}>
          <section className={styles.portfolioPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Mail settings</h2>
                <p className={styles.muted}>
                  SMTP delivery for contact forms, verification codes, and admin
                  sign-in email.
                </p>
              </div>
              <div className={styles.mailHeaderActions}>
                <span
                  className={`${styles.statusBadge} ${mailStatusClass}`}
                  title={`Source: ${mail.source || "database"}`}
                >
                  {mailStatus}
                </span>
              </div>
            </div>

            <div className={styles.mailToggleRow}>
              <label className={styles.checkboxField}>
                <input
                  type="checkbox"
                  checked={mailEnabled}
                  disabled={!mailEditable}
                  onChange={(event) => setMailField("enabled", event.target.checked)}
                />
                Email delivery
              </label>
              <span className={styles.muted}>
                Source: {mail.source === "environment" ? "environment" : "database"}
              </span>
            </div>

            <div className={styles.mailFormStack}>
              <div className={styles.mailAccountGrid}>
                <label className={styles.field}>
                  Provider
                  <select
                    value={mail.provider || "apple"}
                    onChange={(event) => selectMailProvider(event.target.value)}
                  >
                    {MAIL_PROVIDER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  From name
                  <input
                    value={mail.fromName || ""}
                    disabled={!mailEditable}
                    onChange={(event) => setMailField("fromName", event.target.value)}
                    placeholder={process.env.NEXT_PUBLIC_SITE_NAME || "Site"}
                  />
                </label>
                <label className={styles.field}>
                  From email
                  <input
                    type="email"
                    value={mail.from || ""}
                    disabled={!mailEditable}
                    onChange={(event) => setMailField("from", event.target.value)}
                    placeholder="mathias@krostewitz.com"
                  />
                </label>
                <label className={styles.field}>
                  Reply-to
                  <input
                    type="email"
                    value={mail.replyTo || ""}
                    disabled={!mailEditable}
                    onChange={(event) => setMailField("replyTo", event.target.value)}
                    placeholder="Optional"
                  />
                </label>
              </div>

              <label className={`${styles.field} ${styles.mailRecipientsField}`}>
                Notification recipients
                <textarea
                  rows="2"
                  value={recipientsToText(mail.recipients)}
                  disabled={!mailEditable}
                  onChange={(event) =>
                    setMailField("recipients", textToRecipients(event.target.value))
                  }
                  placeholder="mathias@krostewitz.com"
                />
              </label>

              <div className={styles.mailServerGrid}>
                <label className={styles.field}>
                  SMTP host
                  <input
                    value={mail.host || ""}
                    disabled={!mailEditable}
                    onChange={(event) => setMailField("host", event.target.value)}
                    placeholder="smtp.mail.me.com"
                  />
                </label>
                <label className={styles.field}>
                  Port
                  <input
                    type="number"
                    min="1"
                    max="65535"
                    value={mail.port || 587}
                    disabled={!mailEditable}
                    onChange={(event) =>
                      setMailField("port", Number(event.target.value))
                    }
                  />
                </label>
                <label className={styles.field}>
                  SMTP username
                  <input
                    value={mail.username || ""}
                    disabled={!mailEditable}
                    onChange={(event) => setMailField("username", event.target.value)}
                    placeholder="mathias@krostewitz.com"
                    autoComplete="username"
                  />
                </label>
                <label className={styles.field}>
                  SMTP password
                  <input
                    type="password"
                    value={mail.smtpPassword || ""}
                    disabled={!mailEditable}
                    onChange={(event) =>
                      setMailForm((current) => ({
                        ...normalizeMailDraft(current),
                        smtpPassword: event.target.value,
                        clearSmtpPassword: false,
                      }))
                    }
                    placeholder={
                      mail.passwordConfigured && !mail.clearSmtpPassword
                        ? "Enter new password"
                        : "App-specific password"
                    }
                    autoComplete="new-password"
                  />
                </label>
              </div>
            </div>

            <div className={styles.mailFooterRow}>
              <div className={styles.mailSecurityOptions}>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={Boolean(mail.requireTLS)}
                    disabled={!mailEditable}
                    onChange={(event) =>
                      setMailField("requireTLS", event.target.checked)
                    }
                  />
                  Require STARTTLS
                </label>
                <label className={styles.checkboxField}>
                  <input
                    type="checkbox"
                    checked={Boolean(mail.secure)}
                    disabled={!mailEditable}
                    onChange={(event) => setMailField("secure", event.target.checked)}
                  />
                  Use direct TLS
                </label>
              </div>
              <div className={styles.mailPasswordActions}>
                <button
                  type="button"
                  className={`${styles.dangerButton} ${styles.iconTextButton}`}
                  disabled={isSavingMail || isTestingMail}
                  onClick={clearMailSettings}
                >
                  <Trash2 aria-hidden="true" size={16} strokeWidth={2.3} />
                  Clear settings
                </button>
                <button
                  type="button"
                  className={`${styles.ghostButton} ${styles.iconTextButton}`}
                  disabled={isSavingMail || isTestingMail}
                  onClick={() => void sendTestEmail()}
                >
                  <Send aria-hidden="true" size={16} strokeWidth={2.3} />
                  Send test
                </button>
                <button
                  type="button"
                  className={`${styles.button} ${styles.iconTextButton} ${styles.mailSaveButton}`}
                  disabled={isSavingMail || isTestingMail}
                  onClick={() => void saveMailSettings()}
                >
                  <Save aria-hidden="true" size={16} strokeWidth={2.3} />
                  {isSavingMail ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            {mailEnabled && !mail.active && mailMissing.length ? (
              <div className={styles.mailMissingKeys}>
                <span>Missing settings</span>
                <strong>{mailMissing.join(", ")}</strong>
              </div>
            ) : null}

            <p className={styles.muted}>
              Last saved:{" "}
              {formatDate(mail.updatedAt, locale, notSavedLabel)}
              {mail.updatedBy ? ` by ${mail.updatedBy}` : ""}
            </p>
          </section>

          <section className={styles.portfolioPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("koalendar.title")}</h2>
                <p className={styles.muted}>
                  {koalendarConnected
                    ? t("koalendar.connectedDescription", profileTranslationValues)
                    : t(
                        "koalendar.disconnectedDescription",
                        profileTranslationValues
                      )}
                </p>
              </div>
              <span className={styles.statusBadge}>
                {koalendarConnected
                  ? t("koalendar.connected")
                  : t("koalendar.disconnected")}
              </span>
            </div>

            <label className={styles.featureToggle}>
              <input
                checked={koalendarForm.enabled}
                disabled={isSavingKoalendar}
                type="checkbox"
                onChange={(event) =>
                  handleKoalendarInput("enabled", event.target.checked)
                }
              />
              <span className={styles.featureSwitch} aria-hidden="true" />
              <span className={styles.featureText}>
                <strong>{t("koalendar.title")}</strong>
                <small>
                  {koalendarConnected
                    ? t("koalendar.connectedDescription", profileTranslationValues)
                    : t(
                        "koalendar.disconnectedDescription",
                        profileTranslationValues
                      )}
                </small>
              </span>
              <span className={styles.featureStatus}>
                {koalendarConnected
                  ? t("koalendar.connected")
                  : t("koalendar.disconnected")}
              </span>
            </label>

            <div className={styles.integrationFields}>
              <label className={styles.field}>
                {t("fields.koalendarUrl")}
                <input
                  inputMode="url"
                  type="url"
                  value={koalendarForm.bookingUrl}
                  onChange={(event) =>
                    handleKoalendarInput("bookingUrl", event.target.value)
                  }
                />
              </label>

              {koalendarCanOpen && (
                <a
                  className={styles.secondaryButton}
                  href={koalendarBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {t("actions.openKoalendar")}
                </a>
              )}
            </div>

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                {t("fields.lastSaved", {
                  date: formatDate(profile.updatedAt, locale, notSavedLabel),
                })}
              </p>
              <button
                className={styles.button}
                disabled={isSavingKoalendar}
                type="button"
                onClick={() => void saveKoalendarIntegration()}
              >
                {isSavingKoalendar ? t("actions.saving") : t("actions.saveKoalendar")}
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
