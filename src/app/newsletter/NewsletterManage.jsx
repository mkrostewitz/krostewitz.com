"use client";
import {useState} from "react";
import Link from "next/link";
import NewsletterSignup from "../components/newsletter/NewsletterSignup";
import {newsletterCopy} from "../components/newsletter/copy";
import styles from "../components/newsletter/newsletter.module.css";

export default function NewsletterManage({action, token, language}) {
  const copy = newsletterCopy[language];
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const valid = ["confirm", "unsubscribe"].includes(action) && /^[a-f0-9]{64}$/.test(token);
  async function manage() {
    setBusy(true);
    try {
      const response = await fetch("/api/newsletter/manage", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action, token})});
      setStatus(response.ok ? (action === "confirm" ? "confirmed" : "unsubscribed") : response.status === 400 ? "expired" : "manageError");
    } catch { setStatus("manageError"); }
    finally { setBusy(false); }
  }
  const finished = ["confirmed", "unsubscribed", "expired"].includes(status);
  return <>
    <div className={styles.card}>
      <h1>{action === "unsubscribe" ? copy.unsubscribeTitle : copy.confirmTitle}</h1>
      {!valid ? <p>{copy.expired}</p> : <>
        {!finished && <><p>{action === "unsubscribe" ? copy.unsubscribeDescription : copy.confirmDescription}</p>
          <button onClick={manage} disabled={busy}>{busy ? copy.busy : copy[action]}</button></>}
        <p role="status">{status ? copy[status] : ""}</p>
      </>}
      <Link href="/">{copy.back}</Link>
    </div>
    {(!valid || status === "expired") && <NewsletterSignup language={language} />}
  </>;
}
