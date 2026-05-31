"use client";

import {useEffect, useState} from "react";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

export default function SecuritySettings({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [settings, setSettings] = useState(null);
  const [passwordSettings, setPasswordSettings] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [totpResponse, passwordResponse] = await Promise.all([
          fetch("/api/admin/auth/totp", {
            cache: "no-store",
          }),
          fetch("/api/admin/auth/password", {
            cache: "no-store",
          }),
        ]);
        const data = await totpResponse.json().catch(() => ({}));
        const passwordData = await passwordResponse.json().catch(() => ({}));

        if (!totpResponse.ok) {
          throw new Error(data.error || "Unable to load security settings.");
        }

        if (!passwordResponse.ok) {
          throw new Error(
            passwordData.error || "Unable to load password settings.",
          );
        }

        if (!cancelled) {
          setSettings(data);
          setPasswordSettings(passwordData);
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) showSnackbar({type: "error", message: error.message});
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar]);

  async function updatePassword(event) {
    event.preventDefault();
    closeSnackbar();

    if (passwordForm.password !== passwordForm.confirmPassword) {
      showSnackbar({type: "error", message: "Passwords do not match."});
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/password", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({password: passwordForm.password}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update password.");
      }

      setPasswordSettings(data);
      setPasswordForm({password: "", confirmPassword: ""});
      showSnackbar({
        type: "success",
        message: "Admin password updated.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startSetup() {
    setIsSubmitting(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/auth/totp", {method: "POST"});
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to start authenticator setup.");
      }

      setSetup(data);
      setCode("");
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function verifySetup(event) {
    event.preventDefault();
    setIsSubmitting(true);
    closeSnackbar();

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
      showSnackbar({
        type: "success",
        message: "Authenticator sign-in is enabled.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function disableTotp() {
    setIsSubmitting(true);
    closeSnackbar();

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
      showSnackbar({
        type: "success",
        message: "Authenticator sign-in is disabled.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
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
                <h2>Password</h2>
                <p className={styles.muted}>
                  Set a new admin password for password sign-in.
                </p>
              </div>
              <span className={styles.statusBadge}>
                {passwordSettings?.configured ? "Configured" : "Not set"}
              </span>
            </div>

            <form className={styles.form} onSubmit={updatePassword}>
              <label className={styles.field}>
                New password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={passwordForm.password}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className={styles.field}>
                Confirm new password
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <div className={styles.buttonRow}>
                <button
                  className={styles.button}
                  disabled={isSubmitting || !passwordSettings}
                >
                  {isSubmitting ? "Saving..." : "Save password"}
                </button>
              </div>
            </form>
          </div>

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
                        closeSnackbar();
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
          </div>
        </section>
      </main>
    </div>
  );
}
