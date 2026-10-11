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

import {createPortal} from "react-dom";

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
  const [host, setHost] = useState(null);

  useEffect(() => {
    // Native modal dialogs make the rest of the document inert. Keep the global
    // notification inside the active dialog so it remains visible and dismissible.
    function updateHost() {
      const dialogs = [...document.querySelectorAll("dialog:modal")];
      const focusedDialog = document.activeElement?.closest("dialog:modal");
      setHost(focusedDialog || dialogs.at(-1) || document.body);
    }
    updateHost();
    const observer = new MutationObserver(updateHost);
    observer.observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["open"]});
    return () => observer.disconnect();
  }, []);

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
      duration: Object.hasOwn(next, "duration") ? next.duration : next.type === "error" ? null : DEFAULT_DURATION,
    });
  }, []);

  useEffect(() => {
    let invalidFields = [];
    function reportInvalid(event) {
      event.preventDefault();
      const input = event.target;
      invalidFields.push(input);
      if (invalidFields.length > 1) return;
      queueMicrotask(() => {
        const fields = invalidFields;
        invalidFields = [];
        const messages = fields.map((field) => {
          const label = field.getAttribute("aria-label") || field.labels?.[0]?.textContent?.trim() || field.name;
          return `${label ? `${label}: ` : ""}${field.validationMessage}`;
        });
        showSnackbar({type: "error", message: messages.join("\n")});
        fields[0]?.focus();
      });
    }
    document.addEventListener("invalid", reportInvalid, true);
    return () => document.removeEventListener("invalid", reportInvalid, true);
  }, [showSnackbar]);

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
      {host && createPortal(<div className={styles.snackbarViewport}>
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
      </div>, host)}
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
