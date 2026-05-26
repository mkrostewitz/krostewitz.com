"use client";

import {useEffect, useState} from "react";

import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

export default function SecuritySettings({user}) {
  const [settings, setSettings] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState({type: "message", text: "Loading..."});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/auth/totp", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load security settings.");
        }

        if (!cancelled) {
          setSettings(data);
          setStatus(null);
        }
      } catch (error) {
        if (!cancelled) setStatus({type: "error", text: error.message});
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  async function startSetup() {
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/auth/totp", {method: "POST"});
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to start authenticator setup.");
      }

      setSetup(data);
      setCode("");
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifySetup(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/auth/totp", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({code}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to verify authenticator code.");
      }

      setSettings((current) => ({
        ...current,
        enabled: true,
        issuer: data.issuer || current?.issuer,
      }));
      setSetup(null);
      setCode("");
      setStatus({
        type: "success",
        text: "Authenticator sign-in is enabled.",
      });
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function disableTotp() {
    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/auth/totp", {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to disable authenticator.");
      }

      setSettings((current) => ({...current, enabled: false}));
      setSetup(null);
      setCode("");
      setStatus({
        type: "success",
        text: "Authenticator sign-in is disabled.",
      });
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="security" user={user} />

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Security</h1>
            <p className={styles.muted}>Manage admin sign-in methods.</p>
          </div>
        </div>

        <section className={styles.securityGrid}>
          <div className={styles.securityPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Authenticator</h2>
                <p className={styles.muted}>
                  Microsoft Authenticator, Apple Passwords, 1Password, and TOTP apps.
                </p>
              </div>
              <span className={styles.statusBadge}>
                {settings?.enabled ? "Enabled" : "Off"}
              </span>
            </div>

            {setup ? (
              <div className={styles.setupGrid}>
                <div
                  className={styles.qrBox}
                  dangerouslySetInnerHTML={{__html: setup.qrSvg}}
                />

                <form className={styles.form} onSubmit={verifySetup}>
                  <div className={styles.field}>
                    Manual key
                    <code className={styles.secretBox}>{setup.manualSecret}</code>
                  </div>

                  <label className={styles.field}>
                    Authenticator code
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                      maxLength={6}
                      required
                    />
                  </label>

                  <div className={styles.buttonRow}>
                    <button className={styles.button} disabled={isSubmitting}>
                      {isSubmitting ? "Verifying..." : "Verify and enable"}
                    </button>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      disabled={isSubmitting}
                      onClick={() => {
                        setSetup(null);
                        setCode("");
                        setStatus(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={styles.button}
                  disabled={isSubmitting || !settings}
                  onClick={startSetup}
                >
                  {settings?.enabled ? "Replace authenticator" : "Set up authenticator"}
                </button>

                {settings?.enabled && (
                  <button
                    type="button"
                    className={styles.dangerButton}
                    disabled={isSubmitting}
                    onClick={disableTotp}
                  >
                    Disable
                  </button>
                )}
              </div>
            )}

            {status && <p className={styles[status.type]}>{status.text}</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
