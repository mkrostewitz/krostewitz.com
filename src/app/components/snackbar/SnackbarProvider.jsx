"use client";

import {AlertCircle, CheckCircle2, Info, X} from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import styles from "./snackbar.module.css";

const SnackbarContext = createContext(null);
const DEFAULT_DURATION = 4200;

const ICONS = {
  error: AlertCircle,
  info: Info,
  success: CheckCircle2,
};

export function SnackbarProvider({children}) {
  const [snackbar, setSnackbar] = useState(null);
  const timeoutRef = useRef(null);

  const closeSnackbar = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setSnackbar(null);
  }, []);

  const showSnackbar = useCallback((input) => {
    const next =
      typeof input === "string" ? {message: input, type: "info"} : input || {};
    const message = String(next.message || "").trim();

    if (!message) return;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setSnackbar({
      id: Date.now(),
      message,
      title: next.title ? String(next.title) : "",
      type: next.type || "info",
      duration: next.duration ?? DEFAULT_DURATION,
    });
  }, []);

  useEffect(() => {
    if (!snackbar || snackbar.duration === null) return undefined;

    timeoutRef.current = window.setTimeout(() => {
      setSnackbar(null);
      timeoutRef.current = null;
    }, snackbar.duration);

    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [snackbar]);

  const value = useMemo(
    () => ({
      closeSnackbar,
      showSnackbar,
    }),
    [closeSnackbar, showSnackbar]
  );

  const Icon = snackbar ? ICONS[snackbar.type] || Info : null;
  const isError = snackbar?.type === "error";

  return (
    <SnackbarContext.Provider value={value}>
      {children}
      <div className={styles.snackbarViewport} aria-live="polite">
        {snackbar && (
          <section
            className={styles.snackbar}
            data-type={snackbar.type}
            key={snackbar.id}
            role={isError ? "alert" : "status"}
          >
            {Icon && (
              <span className={styles.icon} aria-hidden="true">
                <Icon size={20} strokeWidth={2.2} />
              </span>
            )}
            <div className={styles.content}>
              {snackbar.title && <strong>{snackbar.title}</strong>}
              <span>{snackbar.message}</span>
            </div>
            <button
              aria-label="Dismiss notification"
              className={styles.closeButton}
              type="button"
              onClick={closeSnackbar}
            >
              <X aria-hidden="true" size={17} strokeWidth={2.2} />
            </button>
          </section>
        )}
      </div>
    </SnackbarContext.Provider>
  );
}

export function useSnackbar() {
  const context = useContext(SnackbarContext);

  if (!context) {
    throw new Error("useSnackbar must be used within SnackbarProvider.");
  }

  return context;
}
