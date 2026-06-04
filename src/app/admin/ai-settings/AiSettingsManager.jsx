"use client";

import {useEffect, useState} from "react";

import {useLoadingState} from "../../components/loading/LoadingProvider";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const AI_MODELS = ["gpt-5.5", "gpt-5.2", "chat-latest"];

const EMPTY_FORM = {
  model: "",
  temperature: "",
  agentInstructions: "",
  includeCvContext: true,
  updatedAt: null,
  updatedBy: null,
};

function formatDate(value) {
  if (!value) return "Not saved";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function normalizeForm(settings = {}) {
  return {
    model: settings.model || "",
    temperature:
      settings.temperature === null || settings.temperature === undefined
        ? ""
        : String(settings.temperature),
    agentInstructions: settings.agentInstructions || "",
    includeCvContext: settings.includeCvContext !== false,
    updatedAt: settings.updatedAt || null,
    updatedBy: settings.updatedBy || null,
  };
}

export default function AiSettingsManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [form, setForm] = useState(EMPTY_FORM);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useLoadingState({
    isLoading,
    label: "Loading AI settings...",
    type: "page",
  });
  useLoadingState({
    isLoading: isSaving,
    label: "Saving AI settings...",
    type: "action",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const response = await fetch("/api/admin/ai-settings", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load AI settings.");
        }

        if (!cancelled) {
          setForm(normalizeForm(data.settings));
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) {
          showSnackbar({type: "error", message: error.message});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar]);

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function saveSettings(event) {
    event.preventDefault();
    setIsSaving(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          model: form.model,
          temperature: form.temperature,
          agentInstructions: form.agentInstructions,
          includeCvContext: form.includeCvContext,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to save AI settings.");
      }

      setForm(normalizeForm(data.settings));
      showSnackbar({type: "success", message: "AI settings saved."});
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="aiSettings" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>AI Settings</h1>
            <p className={styles.muted}>
              Configure the global assistant used by the post editor.
            </p>
          </div>
        </div>

        <form className={styles.settingsGrid} onSubmit={saveSettings}>
          <section className={styles.portfolioPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Post assistant</h2>
                <p className={styles.muted}>
                  These settings apply to create, tweak, and translate actions.
                </p>
              </div>
              <span className={styles.statusBadge}>
                {form.includeCvContext ? "CV context on" : "CV context off"}
              </span>
            </div>

            <div className={styles.aiSettingsFields}>
              <label className={styles.field}>
                Model
                <input
                  list="ai-settings-models"
                  placeholder="gpt-5.5"
                  value={form.model}
                  onChange={(event) => updateField("model", event.target.value)}
                />
                <datalist id="ai-settings-models">
                  {AI_MODELS.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </datalist>
              </label>

              <label className={styles.field}>
                Temperature
                <input
                  max="2"
                  min="0"
                  placeholder="0.7"
                  step="0.1"
                  type="number"
                  value={form.temperature}
                  onChange={(event) =>
                    updateField("temperature", event.target.value)
                  }
                />
              </label>
            </div>

            <label className={styles.field}>
              Agent instructions
              <textarea
                rows={7}
                value={form.agentInstructions}
                onChange={(event) =>
                  updateField("agentInstructions", event.target.value)
                }
              />
              <span className={styles.muted}>
                Stored in MongoDB and used by every post AI action.
              </span>
            </label>

            <label className={styles.checkboxField}>
              <input
                checked={form.includeCvContext}
                type="checkbox"
                onChange={(event) =>
                  updateField("includeCvContext", event.target.checked)
                }
              />
              Use uploaded CV documents as author context
            </label>

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                Last saved: {formatDate(form.updatedAt)}
                {form.updatedBy ? ` · ${form.updatedBy}` : ""}
              </p>
              <button className={styles.button} disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
