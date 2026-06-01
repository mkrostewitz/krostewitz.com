"use client";

import {useEffect, useMemo, useState} from "react";
import {useRouter} from "next/navigation";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import styles from "../admin.module.css";

const METHODS = [
  {id: "totp", label: "Authenticator"},
  {id: "email", label: "Email code"},
];

const LINKEDIN_ERROR_MESSAGES = {
  not_configured: "LinkedIn sign-in is not enabled or configured yet.",
  cancelled: "LinkedIn sign-in was cancelled.",
  state: "LinkedIn sign-in could not be verified. Try again.",
  email: "LinkedIn did not return a verified email address.",
  unauthorized: "This LinkedIn account is not allowed to access the admin area.",
  failed: "Unable to complete LinkedIn sign-in.",
};

export default function LoginForm({linkedInSignInEnabled = false}) {
  const router = useRouter();
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [phase, setPhase] = useState("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("email");
  const [availableMethods, setAvailableMethods] = useState(["email"]);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleMethods = useMemo(
    () => METHODS.filter((item) => availableMethods.includes(item.id)),
    [availableMethods],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedInError = params.get("linkedin_error");
    const passwordReset = params.get("password_reset");

    if (!linkedInError && !passwordReset) return;

    if (linkedInError) {
      showSnackbar({
        type: "error",
        message:
          LINKEDIN_ERROR_MESSAGES[linkedInError] ||
          "Unable to complete LinkedIn sign-in.",
      });
    } else if (passwordReset === "success") {
      showSnackbar({
        type: "success",
        message: "Password updated. Sign in with your new password.",
      });
    }

    params.delete("linkedin_error");
    params.delete("password_reset");
    const nextUrl = `${window.location.pathname}${
      params.toString() ? `?${params.toString()}` : ""
    }${window.location.hash}`;
    window.history.replaceState(null, "", nextUrl);
  }, [showSnackbar]);

  async function submitCredentials(event) {
    event.preventDefault();
    setIsSubmitting(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, password}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to start sign-in.");
      }

      setAvailableMethods(data.methods || ["email"]);
      setMethod((data.methods || ["email"])[0] || "email");
      setPhase("secondFactor");
      showSnackbar({
        type: "info",
        message: "Password accepted. Choose a second factor to continue.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startSecondFactor(nextMethod) {
    setIsSubmitting(true);
    closeSnackbar();
    setMethod(nextMethod);

    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          email,
          password,
          method: nextMethod,
          intent: "challenge",
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to start second factor.");
      }

      setChallengeId(data.challengeId);
      setAvailableMethods(data.methods || availableMethods);
      setMethod(data.method);
      setCode("");
      setPhase("verify");
      showSnackbar({
        type: "info",
        message:
          data.method === "email"
            ? "A verification code was sent to the configured admin email."
            : "Enter the current code from your authenticator app.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitVerification(event) {
    event.preventDefault();
    setIsSubmitting(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/auth/verify", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({challengeId, code}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to verify sign-in.");
      }

      router.replace("/admin/posts");
      router.refresh();
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestMagicLink(intent = "sign_in") {
    if (!email.trim()) {
      showSnackbar({type: "error", message: "Enter the admin email first."});
      return;
    }

    setIsSubmitting(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/auth/magic-link", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email, intent}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to send magic link.");
      }

      showSnackbar({
        type: "success",
        message:
          intent === "password_reset"
            ? "Password reset link sent to the configured admin email."
            : "Magic link sent to the configured admin email.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetToCredentials() {
    setPhase("credentials");
    setCode("");
    setChallengeId("");
    closeSnackbar();
  }

  return (
    <div className={styles.loginPanel}>
      <div className={styles.titleBlock}>
        <h1>Admin sign in</h1>
        <p className={styles.muted}>
          Access post management for {process.env.NEXT_PUBLIC_SITE_NAME}.
        </p>
      </div>

      {phase === "credentials" ? (
        <>
          {linkedInSignInEnabled ? (
            <>
              <a
                className={styles.linkedinButton}
                href="/api/admin/auth/linkedin"
                rel="noopener noreferrer"
                target="_blank"
              >
                Sign in with LinkedIn
              </a>

              <div className={styles.loginDivider}>
                <span>or use password</span>
              </div>
            </>
          ) : null}

          <form className={styles.form} onSubmit={submitCredentials}>
            <label className={styles.field}>
              Email
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>Password</span>
                <button
                  type="button"
                  className={styles.inlineButton}
                  disabled={isSubmitting}
                  onClick={() => requestMagicLink("password_reset")}
                >
                  Forgot password?
                </button>
              </span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>

            <div className={styles.buttonRow}>
              <button className={styles.button} disabled={isSubmitting}>
                {isSubmitting ? "Checking..." : "Continue"}
              </button>
              <button
                type="button"
                className={styles.ghostButton}
                disabled={isSubmitting}
                onClick={() => requestMagicLink()}
              >
                Send magic link
              </button>
            </div>
          </form>
        </>
      ) : phase === "secondFactor" ? (
        <div className={styles.form}>
          <div className={styles.field}>
            Second factor
            <div className={styles.methodGrid}>
              {visibleMethods.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`${styles.methodButton} ${
                    method === item.id ? styles.methodButtonActive : ""
                  }`}
                  disabled={isSubmitting}
                  onClick={() => startSecondFactor(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={styles.ghostButton}
            disabled={isSubmitting}
            onClick={resetToCredentials}
          >
            Back
          </button>
        </div>
      ) : (
        <form className={styles.form} onSubmit={submitVerification}>
          <label className={styles.field}>
            Verification code
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
              {isSubmitting ? "Verifying..." : "Sign in"}
            </button>
            <button
              type="button"
              className={styles.ghostButton}
              disabled={isSubmitting}
              onClick={resetToCredentials}
            >
              Back
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
