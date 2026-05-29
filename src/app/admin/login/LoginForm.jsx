"use client";

import {useMemo, useState} from "react";
import {useRouter} from "next/navigation";

import styles from "../admin.module.css";

const METHODS = [
  {id: "totp", label: "Authenticator"},
  {id: "email", label: "Email code"},
];

export default function LoginForm() {
  const router = useRouter();
  const [phase, setPhase] = useState("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [method, setMethod] = useState("email");
  const [availableMethods, setAvailableMethods] = useState(["email"]);
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const visibleMethods = useMemo(
    () => METHODS.filter((item) => availableMethods.includes(item.id)),
    [availableMethods],
  );

  async function submitCredentials(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

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
      setStatus({
        type: "message",
        text: "Password accepted. Choose a second factor to continue.",
      });
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function startSecondFactor(nextMethod) {
    setIsSubmitting(true);
    setStatus(null);
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
      setStatus({
        type: "message",
        text:
          data.method === "email"
            ? "A verification code was sent to the configured admin email."
            : "Enter the current code from your authenticator app.",
      });
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitVerification(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus(null);

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
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  async function requestMagicLink() {
    if (!email.trim()) {
      setStatus({type: "error", text: "Enter the admin email first."});
      return;
    }

    setIsSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/auth/magic-link", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({email}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to send magic link.");
      }

      setStatus(null);
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSubmitting(false);
    }
  }

  function resetToCredentials() {
    setPhase("credentials");
    setCode("");
    setChallengeId("");
    setStatus(null);
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
            Password
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
              onClick={requestMagicLink}
            >
              Send magic link
            </button>
          </div>
        </form>
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

      {status && <p className={styles[status.type]}>{status.text}</p>}
    </div>
  );
}
