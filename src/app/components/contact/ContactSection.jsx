"use client";

import {ErrorMessage, Field, Form, Formik} from "formik";
import Link from "next/link";
import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import * as Yup from "yup";

import pageStyles from "../../page.module.css";
import styles from "./contact-section.module.css";

const ContactSection = () => {
  const {t} = useTranslation();
  const [phase, setPhase] = useState("form"); // form | verify | success
  const [pendingEmail, setPendingEmail] = useState("");
  const [pendingName, setPendingName] = useState("");
  const [apiMessage, setApiMessage] = useState(null);
  const logApiError = (endpoint, res, data) => {
    console.warn("Contact API error", {endpoint, status: res.status, data});
  };

  const contactSchema = useMemo(
    () =>
      Yup.object({
        name: Yup.string().required(t("contact.validation.name")),
        email: Yup.string()
          .email(t("contact.validation.email"))
          .required(t("contact.validation.email")),
        message: Yup.string()
          .min(10, t("contact.validation.message"))
          .required(t("contact.validation.message")),
      }),
    [t]
  );

  const verifySchema = useMemo(
    () =>
      Yup.object({
        code: Yup.string()
          .matches(/^[0-9]{6}$/, t("contact.validation.code"))
          .required(t("contact.validation.codeRequired")),
      }),
    [t]
  );

  return (
    <section id="contact" className={pageStyles.section}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("nav.contact")}</p>
        <h2>{t("contact.title")}</h2>
        <p className={pageStyles.lead}>{t("contact.subtitle")}</p>
      </div>

      <div className={styles.contactGrid}>
        <div className={styles.contactCard}>
          <h3>{t("meeting")}</h3>
          <p>{t("hero.subtitle")}</p>
          <Link
            className={pageStyles.primary}
            href="https://koalendar.com/e/meet-with-mathias-krostewitz"
            target="_blank"
            rel="noreferrer"
          >
            {t("hero.booking")}
          </Link>
          <Link
            href="https://www.linkedin.com/in/mathias-krostewitz"
            className={pageStyles.secondary}
            target="_blank"
            rel="noreferrer"
          >
            {t("linkedin")}
          </Link>
        </div>

        {phase === "form" && (
          <Formik
            initialValues={{name: "", email: "", message: ""}}
            validationSchema={contactSchema}
            onSubmit={async (values, {setSubmitting, resetForm, setStatus}) => {
              setStatus(null);
              setApiMessage(null);
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
                    t("contact.errorGeneric");

                  if (res.status === 409 || res.status === 400) {
                    setStatus({state: "error", message});
                    return;
                  }

                  throw new Error(message);
                }

                if (data.status === "verify_required") {
                  setPendingEmail(values.email);
                  setPendingName(values.name);
                  setPhase("verify");
                  setApiMessage(t("contact.verifySent"));
                  return;
                }

                setStatus({state: "sent"});
                resetForm();
              } catch (err) {
                console.error("Contact submit error", err);
                setStatus({
                  state: "error",
                  message:
                    err.message ||
                    "Something went wrong. Please try again.",
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({isSubmitting, status}) => (
              <Form className={styles.form}>
                <label>
                  {t("contact.name")}
                  <Field name="name" placeholder="Jane Doe" />
                  <ErrorMessage
                    name="name"
                    component="span"
                    className={styles.error}
                  />
                </label>
                <label>
                  {t("contact.email")}
                  <Field
                    name="email"
                    type="email"
                    placeholder="you@email.com"
                  />
                  <ErrorMessage
                    name="email"
                    component="span"
                    className={styles.error}
                  />
                </label>
                <label>
                  {t("contact.message")}
                  <Field
                    as="textarea"
                    rows="4"
                    name="message"
                    placeholder="Tell me about the challenge..."
                  />
                  <ErrorMessage
                    name="message"
                    component="span"
                    className={styles.error}
                  />
                </label>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={pageStyles.primary}
                >
                  {isSubmitting ? "Sending..." : t("contact.submit")}
                </button>
                {status?.state === "sent" && (
                  <p className={styles.success}>{t("contact.success")}</p>
                )}
                {status?.state === "error" && (
                  <p className={styles.error}>{status.message}</p>
                )}
                {apiMessage && <p className={styles.success}>{apiMessage}</p>}
              </Form>
            )}
          </Formik>
        )}

        {phase === "verify" && (
          <Formik
            initialValues={{code: ""}}
            validationSchema={verifySchema}
            onSubmit={async (values, {setSubmitting, setStatus}) => {
              setStatus(null);
              setApiMessage(null);
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
                    t("contact.errorGeneric");
                  if (res.status === 400 || res.status === 404) {
                    setStatus({state: "error", message});
                    return;
                  }
                  throw new Error(message);
                }

                setPhase("success");
                setApiMessage(t("contact.verifySuccess"));
              } catch (err) {
                console.error("Contact verify error", err);
                setStatus({
                  state: "error",
                  message:
                    err.message ||
                    "Something went wrong. Please try again.",
                });
              } finally {
                setSubmitting(false);
              }
            }}
          >
            {({isSubmitting, status}) => (
              <Form className={styles.form}>
                <p>
                  {t("contact.verifyPrompt", {email: pendingEmail})}
                </p>
                <label>
                  {t("contact.verifyCodeLabel")}
                  <Field
                    name="code"
                    placeholder={t("contact.verifyCodePlaceholder")}
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
                    className={pageStyles.primary}
                  >
                    {isSubmitting
                      ? t("contact.verifySubmit")
                      : t("contact.verifySubmit")}
                  </button>
                  <button
                    type="button"
                    className={pageStyles.secondary}
                    onClick={() => {
                      setPhase("form");
                      setApiMessage(null);
                    }}
                  >
                    {t("contact.verifyEdit")}
                  </button>
                </div>
                {status?.state === "error" && (
                  <p className={styles.error}>{status.message}</p>
                )}
                {apiMessage && <p className={styles.success}>{apiMessage}</p>}
              </Form>
            )}
          </Formik>
        )}

        {phase === "success" && (
          <div className={styles.form}>
            <p className={styles.success}>{t("contact.verifySuccess")}</p>
            <button
              type="button"
              className={pageStyles.primary}
              onClick={() => {
                setPhase("form");
                setPendingEmail("");
                setPendingName("");
                setApiMessage(null);
              }}
            >
              Send another
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default ContactSection;
