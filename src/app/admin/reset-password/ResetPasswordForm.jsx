"use client";

import Link from "next/link";
import {useRouter} from "next/navigation";
import {useState} from "react";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import styles from "../admin.module.css";

const MIN_PASSWORD_LENGTH = 12;

export default function ResetPasswordForm({challenge, token}) {
  const router = useRouter();
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [passwordForm, setPasswordForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const hasResetToken = Boolean(challenge && token);

  async function submitPassword(event) {
    event.preventDefault();
    closeSnackbar();

    if (passwordForm.password !== passwordForm.confirmPassword) {
      showSnackbar({type: "error", message: "Passwords do not match."});
      return;
    }

    if (passwordForm.password.length < MIN_PASSWORD_LENGTH) {
      showSnackbar({
        type: "error",
        message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/auth/magic-link", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          challenge,
          token,
          password: passwordForm.password,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to reset password.");
      }

      setPasswordForm({password: "", confirmPassword: ""});
      showSnackbar({type: "success", message: "Admin password updated."});
      router.replace("/admin/login?password_reset=success");
      router.refresh();
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.loginPanel}>
      <div className={styles.titleBlock}>
        <h1>Reset password</h1>
        <p className={styles.muted}>
          Set a new admin password for password sign-in.
        </p>
      </div>

      {hasResetToken ? (
        <form className={styles.form} onSubmit={submitPassword}>
          <label className={styles.field}>
            New password
            <input
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
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
              minLength={MIN_PASSWORD_LENGTH}
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
            <button className={styles.button} disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save password"}
            </button>
            <Link className={styles.ghostButton} href="/admin/login">
              Back to sign in
            </Link>
          </div>
        </form>
      ) : (
        <>
          <p className={styles.error}>
            This password reset link is missing required information.
          </p>
          <Link className={styles.button} href="/admin/login">
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}
