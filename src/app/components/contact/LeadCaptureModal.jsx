"use client";

import {ErrorMessage, Field, Form, Formik} from "formik";
import {X} from "lucide-react";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import * as Yup from "yup";

import {useSnackbar} from "../snackbar/SnackbarProvider";
import styles from "./contact-section.module.css";

const REQUEST_TYPE_OPTIONS = [
  "headhunter",
  "employer",
  "potential_client",
  "fan",
  "other",
];
const CV_DOWNLOAD_LANGUAGE_ORDER = ["en", "de"];

function normalizeLanguageCode(language) {
  return String(language || "en")
    .split("-")[0]
    .toLowerCase();
}

function addLanguageToDownloadUrl(downloadUrl, language) {
  if (!downloadUrl || !language) return downloadUrl || "";

  const separator = downloadUrl.includes("?") ? "&" : "?";
  return `${downloadUrl}${separator}language=${encodeURIComponent(language)}`;
}

function isLiveCvAsset(asset) {
  return asset?.source === "digitalocean" && Boolean(asset?.fileName);
}

function sortCvDownloads(entries, preferredLanguage) {
  return entries.sort(([firstLanguage], [secondLanguage]) => {
    if (firstLanguage === preferredLanguage) return -1;
    if (secondLanguage === preferredLanguage) return 1;

    const firstIndex = CV_DOWNLOAD_LANGUAGE_ORDER.indexOf(firstLanguage);
    const secondIndex = CV_DOWNLOAD_LANGUAGE_ORDER.indexOf(secondLanguage);

    return (
      (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) -
      (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex)
    );
  });
}

function phoneLooksValid(value, required) {
  const rawValue = String(value || "").trim();

  if (!rawValue) return !required;

  const plusCount = (rawValue.match(/\+/g) || []).length;
  const digits = rawValue.replace(/\D/g, "");
  const uniqueDigits = new Set(digits);

  if (plusCount > 1 || (plusCount === 1 && rawValue[0] !== "+")) return false;
  if (digits.length < 8 || digits.length > 15) return false;
  if (uniqueDigits.size < 3) return false;

  return true;
}

function pageUrl() {
  if (typeof window === "undefined") return "";
  return window.location.href;
}

export default function LeadCaptureModal({
  cvDownloads = {},
  cvLanguage = "en",
  isOpen,
  onClose,
  onVerified,
  sourceType = "contact_form",
}) {
  const {i18n, t} = useTranslation();
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [phase, setPhase] = useState("form");
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingLeadId, setPendingLeadId] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const isCvRequest = sourceType === "cv_download";
  const copyPrefix = isCvRequest ? "cv.form" : "contact.form";

  const closeLabelDefault = "Close";
  const modalTitle = isCvRequest ? t("cv.form.title") : t("contact.form.submit");

  useEffect(() => {
    if (!isOpen) return undefined;

    function closeFromKeyboard() {
      setPhase("form");
      setPendingEmail("");
      setPendingLeadId("");
      setPendingName("");
      setDownloadUrl("");
      closeSnackbar();
      onClose();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        closeFromKeyboard();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [closeSnackbar, isOpen, onClose]);

  const formSchema = useMemo(
    () =>
      Yup.object({
        name: Yup.string().required(t("contact.form.validation.name")),
        email: Yup.string()
          .email(t("contact.form.validation.email"))
          .required(t("contact.form.validation.email")),
        phone: Yup.string().test(
          "valid-phone",
          isCvRequest
            ? t("cv.form.validation.phone")
            : t("cv.form.validation.phone"),
          (value) => phoneLooksValid(value, isCvRequest)
        ),
        requestType: isCvRequest
          ? Yup.string().required(t("cv.form.validation.requestType"))
          : Yup.string(),
        message: isCvRequest
          ? Yup.string()
          : Yup.string()
              .min(10, t("contact.form.validation.message"))
              .required(t("contact.form.validation.message")),
      }),
    [isCvRequest, t]
  );

  const verifySchema = useMemo(
    () =>
      Yup.object({
        code: Yup.string()
          .matches(/^[0-9]{6}$/, t("contact.form.validation.code"))
          .required(t("contact.form.validation.codeRequired")),
      }),
    [t]
  );

  const downloadOptions = useMemo(() => {
    if (!downloadUrl) return [];

    const preferredLanguage = normalizeLanguageCode(cvLanguage);
    const entries = sortCvDownloads(
      Object.entries(cvDownloads || {}).filter(([, asset]) => isLiveCvAsset(asset)),
      preferredLanguage
    );

    if (entries.length === 0) {
      return [
        {
          fileName: "",
          label: t("cv.form.downloadReady"),
          language: preferredLanguage,
          url: downloadUrl,
        },
      ];
    }

    return entries.map(([language, asset]) => ({
      fileName: asset.fileName || "",
      label: t(`cv.form.downloadLanguages.${language}`, {
        defaultValue: language.toUpperCase(),
      }),
      language,
      url: addLanguageToDownloadUrl(downloadUrl, language),
    }));
  }, [cvDownloads, cvLanguage, downloadUrl, t]);

  if (!isOpen) return null;

  function resetAndClose() {
    setPhase("form");
    setPendingEmail("");
    setPendingLeadId("");
    setPendingName("");
    setDownloadUrl("");
    closeSnackbar();
    onClose();
  }

  return (
    <div
      className={styles.modalOverlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          resetAndClose();
        }
      }}
    >
      <div
        aria-labelledby="lead-capture-modal-title"
        aria-modal="true"
        className={styles.modalPanel}
        role="dialog"
      >
        <div className={styles.modalHeader}>
          <div>
            <p className={styles.kicker}>
              {isCvRequest ? t("cv.form.eyebrow") : t("contact.eyebrow")}
            </p>
            <h3 id="lead-capture-modal-title">{modalTitle}</h3>
          </div>
          <button
            type="button"
            className={styles.modalClose}
            aria-label={t("contact.form.close", {
              defaultValue: closeLabelDefault,
            })}
            title={t("contact.form.close", {
              defaultValue: closeLabelDefault,
            })}
            onClick={resetAndClose}
          >
            <X aria-hidden="true" size={20} strokeWidth={2.3} />
          </button>
        </div>

        {phase === "form" && (
          <Formik
            initialValues={{
              name: "",
              email: "",
              phone: "",
              requestType: "",
              message: "",
            }}
            validationSchema={formSchema}
            onSubmit={async (values, {setSubmitting}) => {
              closeSnackbar();
              try {
                const res = await fetch("/api/contact", {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  body: JSON.stringify({
                    ...values,
                    sourceType,
                    cvLanguage,
                    language: i18n.resolvedLanguage || i18n.language || cvLanguage,
                    pageUrl: pageUrl(),
                  }),
                });

                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  const message =
                    (data.errorCode && t(data.errorCode)) ||
                    data.error ||
                    t("contact.form.errorGeneric");

                  if (res.status >= 400 && res.status < 500) {
                    showSnackbar({type: "error", message});
                    return;
                  }

                  throw new Error(message);
                }

                if (data.status === "verify_required") {
                  setPendingEmail(values.email);
                  setPendingLeadId(data.leadId || "");
                  setPendingName(values.name);
                  setPhase("verify");
                  showSnackbar({
                    type: "info",
                    message: t(`${copyPrefix}.verifySent`),
                  });
                }
              } catch (err) {
                console.error("Lead submit error", err);
                showSnackbar({
                  type: "error",
                  message: err.message || t("contact.form.errorGeneric"),
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({isSubmitting}) => (
              <Form
                className={`${styles.formPanel} ${styles.form} ${styles.modalForm}`}
              >
                <div className={styles.modalBody}>
                  {isCvRequest && (
                    <p className={styles.formIntro}>{t("cv.form.intro")}</p>
                  )}

                  <div
                    className={`${styles.fields} ${
                      isCvRequest ? styles.cvFields : ""
                    }`}
                  >
                    <label className={styles.field}>
                      {t("contact.form.name")}
                      <Field
                        name="name"
                        placeholder={t("contact.form.placeholderName")}
                      />
                      <ErrorMessage
                        name="name"
                        component="span"
                        className={styles.error}
                      />
                    </label>
                    <label className={styles.field}>
                      {t("contact.form.email")}
                      <Field
                        name="email"
                        type="email"
                        placeholder={t("contact.form.placeholderEmail")}
                      />
                      <ErrorMessage
                        name="email"
                        component="span"
                        className={styles.error}
                      />
                    </label>

                    {isCvRequest && (
                      <>
                        <label className={styles.field}>
                          {t("cv.form.phone")}
                          <Field
                            name="phone"
                            type="tel"
                            placeholder={t("cv.form.placeholderPhone")}
                          />
                          <ErrorMessage
                            name="phone"
                            component="span"
                            className={styles.error}
                          />
                        </label>

                        <label className={styles.field}>
                          {t("cv.form.requestType")}
                          <Field as="select" name="requestType">
                            <option value="">
                              {t("cv.form.placeholderRequestType")}
                            </option>
                            {REQUEST_TYPE_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {t(`cv.form.requestTypes.${option}`)}
                              </option>
                            ))}
                          </Field>
                          <ErrorMessage
                            name="requestType"
                            component="span"
                            className={styles.error}
                          />
                        </label>
                      </>
                    )}

                    {!isCvRequest && (
                      <label className={styles.field}>
                        {t("contact.form.message")}
                        <Field
                          as="textarea"
                          rows="5"
                          name="message"
                          placeholder={t("contact.form.placeholderMessage")}
                        />
                        <ErrorMessage
                          name="message"
                          component="span"
                          className={styles.error}
                        />
                      </label>
                    )}
                  </div>

                  <div className={styles.formFooter}>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`primary ${styles.submitButton}`}
                    >
                      {isSubmitting
                        ? t(`${copyPrefix}.sending`)
                        : t(`${copyPrefix}.submit`)}
                    </button>
                  </div>
                </div>
              </Form>
            )}
          </Formik>
        )}

        {phase === "verify" && (
          <Formik
            initialValues={{code: ""}}
            validationSchema={verifySchema}
            onSubmit={async (values, {setSubmitting}) => {
              closeSnackbar();
              try {
                const res = await fetch("/api/contact/verify", {
                  method: "POST",
                  headers: {"Content-Type": "application/json"},
                  body: JSON.stringify({
                    leadId: pendingLeadId,
                    email: pendingEmail,
                    code: values.code,
                  }),
                });
                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                  const message =
                    (data.errorCode && t(data.errorCode)) ||
                    data.error ||
                    t("contact.form.errorGeneric");
                  if (res.status >= 400 && res.status < 500) {
                    showSnackbar({type: "error", message});
                    return;
                  }
                  throw new Error(message);
                }

                setDownloadUrl(data.downloadUrl || "");
                setPhase("success");
                showSnackbar({
                  type: "success",
                  message: t(`${copyPrefix}.verifySuccess`),
                });

                if (data.downloadUrl) {
                  onVerified?.(data);
                }
              } catch (err) {
                console.error("Lead verify error", err);
                showSnackbar({
                  type: "error",
                  message: err.message || t("contact.form.errorGeneric"),
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({isSubmitting}) => (
              <Form
                className={`${styles.formPanel} ${styles.form} ${styles.modalForm}`}
              >
                <div className={styles.modalBody}>
                  <div className={styles.formHeader}>
                    <p className={styles.kicker}>
                      {t("contact.form.verifyEyebrow")}
                    </p>
                    <h3>{t("contact.form.verifyTitle")}</h3>
                    <p>
                      {t("contact.form.verifyPrompt", {
                        name: pendingName,
                        email: pendingEmail,
                      })}
                    </p>
                  </div>
                  <label className={styles.field}>
                    {t("contact.form.verifyCodeLabel")}
                    <Field
                      name="code"
                      placeholder={t("contact.form.verifyCodePlaceholder")}
                      maxLength="6"
                    />
                    <ErrorMessage
                      name="code"
                      component="span"
                      className={styles.error}
                    />
                  </label>
                  <div className={styles.actionsRow}>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`primary ${styles.submitButton}`}
                    >
                      {t("contact.form.verifySubmit")}
                    </button>
                    <button
                      type="button"
                      className={`secondary ${styles.submitButton}`}
                      onClick={() => setPhase("form")}
                    >
                      {t("contact.form.verifyEdit")}
                    </button>
                  </div>
                </div>
              </Form>
            )}
          </Formik>
        )}

        {phase === "success" && (
          <div
            className={`${styles.formPanel} ${styles.successBlock} ${styles.modalForm}`}
          >
            <div className={styles.modalBody}>
              <p className={styles.kicker}>{t(`${copyPrefix}.successEyebrow`)}</p>
              <h3>{t(`${copyPrefix}.successTitle`)}</h3>
              {downloadUrl ? (
                <>
                  <p className={styles.formIntro}>
                    {t("cv.form.downloadPrompt")}
                  </p>
                  <div className={styles.actionsRow}>
                    {downloadOptions.map((option, index) => (
                      <button
                        key={option.language}
                        type="button"
                        className={`${
                          index === 0 ? "primary" : "secondary"
                        } ${styles.submitButton}`}
                        title={option.fileName || option.label}
                        onClick={() => {
                          window.location.assign(option.url);
                        }}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  className={`primary ${styles.submitButton}`}
                  onClick={() => {
                    setPhase("form");
                    setPendingName("");
                    setPendingEmail("");
                    setPendingLeadId("");
                    closeSnackbar();
                  }}
                >
                  {t("contact.form.sendAnother")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
