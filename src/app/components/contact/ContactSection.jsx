import {ErrorMessage, Field, Form, Formik} from "formik";
import {X} from "lucide-react";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import * as Yup from "yup";

import AddressMap from "../address-map/AddressMap";
import {useSnackbar} from "../snackbar/SnackbarProvider";
import pageStyles from "../../page.module.css";
import "../../buttons.css";
import styles from "./contact-section.module.css";

const CONTACT_EMAIL = String(process.env.NEXT_PUBLIC_CONTACT_EMAIL || "").trim();

const ContactSection = () => {
  const {i18n, t} = useTranslation();
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [phase, setPhase] = useState("form"); // form | verify | success
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [profile, setProfile] = useState({address: null});
  const logApiError = (endpoint, res, data) => {
    console.warn("Contact API error", {endpoint, status: res.status, data});
  };
  const address = profile.address?.label ? profile.address : null;
  const bookingUrl =
    profile.koalendar?.enabled && profile.koalendar?.bookingUrl
      ? profile.koalendar.bookingUrl
      : "";
  const addressLabelDefault = i18n.language?.toLowerCase().startsWith("de")
    ? "Adresse"
    : "Address";
  const addressMapLabelDefault = i18n.language?.toLowerCase().startsWith("de")
    ? "Karte der Adresse"
    : "Address map";
  const closeLabelDefault = i18n.language?.toLowerCase().startsWith("de")
    ? "Schließen"
    : "Close";

  const contactSchema = useMemo(
    () =>
      Yup.object({
        name: Yup.string().required(t("contact.form.validation.name")),
        email: Yup.string()
          .email(t("contact.form.validation.email"))
          .required(t("contact.form.validation.email")),
        message: Yup.string()
          .min(10, t("contact.form.validation.message"))
          .required(t("contact.form.validation.message")),
      }),
    [t],
  );

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        const response = await fetch("/api/content/profile", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!cancelled && response.ok) {
          setProfile(data.profile || {address: null});
        }
      } catch (error) {
        console.warn("Unable to load contact profile", error);
      }
    }

    loadProfile();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isModalOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsModalOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isModalOpen]);

  function openContactModal() {
    setPhase("form");
    setPendingName("");
    setPendingEmail("");
    closeSnackbar();
    setIsModalOpen(true);
  }

  const verifySchema = useMemo(
    () =>
      Yup.object({
        code: Yup.string()
          .matches(/^[0-9]{6}$/, t("contact.form.validation.code"))
          .required(t("contact.form.validation.codeRequired")),
      }),
    [t],
  );

  return (
    <section id="contact" className={`${pageStyles.section} ${styles.section}`}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("contact.eyebrow")}</p>
        <h2>{t("contact.title")}</h2>
        <p className={pageStyles.lead}>{t("contact.intro")}</p>
      </div>

      <div className={styles.contactGrid}>
        <aside className={styles.contactCard}>
          <div className={styles.cardIntro}>
            <h3>{t("contact.directTitle")}</h3>
            <p>{t("contact.directNote")}</p>
          </div>

          <div className={styles.contactStack}>
            <div className={styles.contactDetails}>
              <a className={styles.contactLink} href="tel:+16505615752">
                <span>{t("contact.phoneLabel")}</span>
                <strong>{t("contact.phoneNumber")}</strong>
              </a>
              {CONTACT_EMAIL && (
                <a
                  className={styles.contactLink}
                  href={`mailto:${CONTACT_EMAIL}`}
                >
                  <span>{t("contact.emailLabel")}</span>
                  <strong>{CONTACT_EMAIL}</strong>
                </a>
              )}
              {address && (
                <address className={styles.contactAddress}>
                  <span>
                    {t("contact.addressLabel", {
                      defaultValue: addressLabelDefault,
                    })}
                  </span>
                  <strong>{address.label}</strong>
                </address>
              )}
            </div>
          </div>

          <div className={styles.contactActions}>
            {bookingUrl && (
              <Link
                className={`primary ${styles.actionButton}`}
                href={bookingUrl}
                target="_blank"
                rel="noreferrer"
              >
                {t("buttons.booking")}
              </Link>
            )}
            <button
              type="button"
              className={`secondary ${styles.actionButton}`}
              onClick={openContactModal}
            >
              {t("contact.form.submit")}
            </button>
            <Link
              aria-label={t("buttons.linkedin")}
              className={styles.linkedinIcon}
              href="https://www.linkedin.com/in/mkrostewitz"
              target="_blank"
              rel="noreferrer"
              title={t("buttons.linkedin")}
            >
              in
            </Link>
          </div>
        </aside>

        {address && (
          <AddressMap
            address={address}
            className={styles.contactMap}
            label={t("contact.addressMapLabel", {
              defaultValue: addressMapLabelDefault,
            })}
            markerScale={0.72}
            zoom={12.9}
          />
        )}
      </div>

      {isModalOpen && (
        <div
          className={styles.modalOverlay}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsModalOpen(false);
            }
          }}
        >
          <div
            aria-labelledby="contact-modal-title"
            aria-modal="true"
            className={styles.modalPanel}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.kicker}>{t("contact.eyebrow")}</p>
                <h3 id="contact-modal-title">{t("contact.form.submit")}</h3>
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
                onClick={() => setIsModalOpen(false)}
              >
                <X aria-hidden="true" size={20} strokeWidth={2.3} />
              </button>
            </div>

            {phase === "form" && (
              <Formik
                initialValues={{name: "", email: "", message: ""}}
                validationSchema={contactSchema}
                onSubmit={async (values, {setSubmitting, resetForm}) => {
                  closeSnackbar();
                  try {
                    const res = await fetch("/api/contact", {
                      method: "POST",
                      headers: {"Content-Type": "application/json"},
                      body: JSON.stringify(values),
                    });

                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      logApiError("/api/contact", res, data);
                      const message =
                        (data.errorCode && t(data.errorCode)) ||
                        data.error ||
                        t("contact.form.errorGeneric");

                      if (res.status === 409 || res.status === 400) {
                        showSnackbar({type: "error", message});
                        return;
                      }

                      throw new Error(message);
                    }

                    if (data.status === "verify_required") {
                      setPendingEmail(values.email);
                      setPendingName(values.name);
                      setPhase("verify");
                      showSnackbar({
                        type: "info",
                        message: t("contact.form.verifySent"),
                      });
                      return;
                    }

                    showSnackbar({
                      type: "success",
                      message: t("contact.form.success"),
                    });
                    resetForm();
                  } catch (err) {
                    console.error("Contact submit error", err);
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
                      <div className={styles.fields}>
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
                      </div>

                      <div className={styles.formFooter}>
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className={`primary ${styles.submitButton}`}
                        >
                          {isSubmitting
                            ? t("contact.form.sending")
                            : t("contact.form.submit")}
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
                        email: pendingEmail,
                        code: values.code,
                      }),
                    });
                    const data = await res.json().catch(() => ({}));

                    if (!res.ok) {
                      logApiError("/api/contact/verify", res, data);
                      const message =
                        (data.errorCode && t(data.errorCode)) ||
                        data.error ||
                        t("contact.form.errorGeneric");
                      if (res.status === 400 || res.status === 404) {
                        showSnackbar({type: "error", message});
                        return;
                      }
                      throw new Error(message);
                    }

                    setPhase("success");
                    showSnackbar({
                      type: "success",
                      message: t("contact.form.verifySuccess"),
                    });
                  } catch (err) {
                    console.error("Contact verify error", err);
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
                  <p className={styles.kicker}>
                    {t("contact.form.successEyebrow")}
                  </p>
                  <h3>{t("contact.form.successTitle")}</h3>
                  <button
                    type="button"
                    className={`primary ${styles.submitButton}`}
                    onClick={() => {
                      setPhase("form");
                      setPendingName("");
                      setPendingEmail("");
                      closeSnackbar();
                    }}
                  >
                    {t("contact.form.sendAnother")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default ContactSection;
