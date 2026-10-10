"use client";

import Link from "next/link";
import {useId, useState} from "react";
import {useTranslation} from "react-i18next";
import "../../../lib/i18n";
import {newsletterCopy} from "./copy";
import styles from "./newsletter.module.css";

export default function NewsletterSignup({language: initialLanguage}) {
  const {i18n} = useTranslation();
  const language = (initialLanguage || i18n.resolvedLanguage || i18n.language || "en").startsWith("de") ? "de" : "en";
  const copy = newsletterCopy[language];
  const id = useId();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function subscribe(event) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/newsletter", {method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email: data.get("email"), website: data.get("website"), consent: data.get("consent") === "on", language})});
      const result = await response.json();
      if (!response.ok) setStatus(["invalid", "rateLimit"].includes(result.error) ? result.error : "unavailable");
      else { setStatus("success"); form.reset(); }
    } catch { setStatus("unavailable"); }
    finally { setBusy(false); }
  }
  return (
    <section className={styles.card} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{copy.title}</h2>
      <p>{copy.description}</p>
      <form onSubmit={subscribe} className={styles.form} aria-busy={busy}>
        <label htmlFor={`${id}-email`}>{copy.email}</label>
        <div className={styles.row}>
          <input id={`${id}-email`} name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
          <button type="submit" disabled={busy}>{busy ? copy.busy : copy.submit}</button>
        </div>
        <div className={styles.trap} aria-hidden="true">
          <label htmlFor={`${id}-website`}>Website</label>
          <input id={`${id}-website`} name="website" tabIndex={-1} autoComplete="off" />
        </div>
        <label className={styles.consent}>
          <input name="consent" type="checkbox" required />
          <span>{copy.consent} <Link href="/privacy">{copy.privacy}</Link></span>
        </label>
        <p role="status" aria-live="polite">{status ? copy[status] : ""}</p>
      </form>
    </section>
  );
}
