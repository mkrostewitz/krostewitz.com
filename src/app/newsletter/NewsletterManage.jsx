"use client";
import {useState} from "react";
import Link from "next/link";
import {ArrowLeft, Check, Mail, MailMinus} from "lucide-react";
import NewsletterSignup from "../components/newsletter/NewsletterSignup";
import {newsletterCopy} from "../components/newsletter/copy";
import styles from "./newsletter-page.module.css";

export default function NewsletterManage({action, token, language}) {
  const copy = newsletterCopy[language];
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = ["confirm", "unsubscribe"].includes(action) && /^[a-f0-9]{64}$/.test(token);
  async function manage() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch("/api/newsletter/manage", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action, token})});
      setStatus(response.ok ? (action === "confirm" ? "confirmed" : "unsubscribed") : response.status === 400 ? "expired" : "manageError");
    } catch { setStatus("manageError"); }
    finally { setBusy(false); }
  }
  const finished = ["confirmed", "unsubscribed", "expired"].includes(status);
  return <>
    <section className={styles.card} aria-labelledby="newsletter-title" aria-busy={busy}>
      <div className={styles.icon} aria-hidden="true">
        {status === "confirmed" || status === "unsubscribed" ? <Check size={28} /> : action === "unsubscribe" ? <MailMinus size={28} /> : <Mail size={28} />}
      </div>
      <span className={styles.eyebrow}>Newsletter</span>
      <h1 id="newsletter-title">{status === "confirmed" ? (language === "de" ? "Du bist dabei." : "You’re subscribed.") : status === "unsubscribed" ? (language === "de" ? "Du bist abgemeldet." : "You’re unsubscribed.") : action === "unsubscribe" ? copy.unsubscribeTitle : copy.confirmTitle}</h1>
      {!valid ? <p>{copy.expired}</p> : <>
        {!finished && <><p>{action === "unsubscribe" ? copy.unsubscribeDescription : copy.confirmDescription}</p>
          <button onClick={manage} disabled={busy}>{busy ? copy.busy : copy[action]}</button></>}
        <p role="status" className={styles.status}>{status ? copy[status] : ""}</p>
      </>}
      <Link href="/" className={styles.back}><ArrowLeft size={16} aria-hidden="true" />{copy.back}</Link>
    </section>
    {(!valid || status === "expired") && <NewsletterSignup language={language} />}
  </>;
}
