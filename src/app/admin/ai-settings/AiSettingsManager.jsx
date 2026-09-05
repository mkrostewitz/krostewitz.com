"use client";

import {useEffect, useState} from "react";
import {ChevronDown, ExternalLink} from "lucide-react";

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

const EMPTY_AI_CHAT_FORM = {
  enabled: false,
  scriptTag: "",
};

const SETTINGS_CARD_ID = "agent-settings-card";
const EMBED_CARD_ID = "agent-embed-card";

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

function normalizeAiChatForm(aiChat = {}) {
  return {
    enabled: aiChat.enabled === true,
    scriptTag: String(aiChat.scriptTag || ""),
  };
}

export default function AiSettingsManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiChatForm, setAiChatForm] = useState(EMPTY_AI_CHAT_FORM);
  const [profileUpdatedAt, setProfileUpdatedAt] = useState(null);
  const [expandedCards, setExpandedCards] = useState({
    settings: true,
    embed: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingAiChat, setIsSavingAiChat] = useState(false);
  const aiChatHasScript = aiChatForm.scriptTag.trim().length > 0;
  const aiChatEnabled = aiChatForm.enabled && aiChatHasScript;
  const settingsExpanded = expandedCards.settings;
  const embedExpanded = expandedCards.embed;

  useLoadingState({
    isLoading,
    label: "Loading agent settings...",
    type: "page",
  });
  useLoadingState({
    isLoading: isSaving,
    label: "Saving agent settings...",
    type: "action",
  });
  useLoadingState({
    isLoading: isSavingAiChat,
    label: "Saving agent embed...",
    type: "action",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      try {
        const [settingsResponse, profileResponse] = await Promise.all([
          fetch("/api/admin/ai-settings", {cache: "no-store"}),
          fetch("/api/admin/profile", {cache: "no-store"}),
        ]);
        const [settingsData, profileData] = await Promise.all([
          settingsResponse.json().catch(() => ({})),
          profileResponse.json().catch(() => ({})),
        ]);

        if (!settingsResponse.ok) {
          throw new Error(settingsData.error || "Unable to load agent settings.");
        }

        if (!profileResponse.ok) {
          throw new Error(profileData.error || "Unable to load agent embed.");
        }

        if (!cancelled) {
          setForm(normalizeForm(settingsData.settings));
          setAiChatForm(normalizeAiChatForm(profileData.profile?.aiChat));
          setProfileUpdatedAt(profileData.profile?.updatedAt || null);
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

  function updateAiChatField(name, value) {
    setAiChatForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function toggleCard(name) {
    setExpandedCards((current) => ({
      ...current,
      [name]: !current[name],
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
        throw new Error(data.error || "Unable to save agent settings.");
      }

      setForm(normalizeForm(data.settings));
      showSnackbar({type: "success", message: "Agent settings saved."});
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsSaving(false);
    }
  }

  async function saveAiChatIntegration() {
    setIsSavingAiChat(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({aiChat: aiChatForm}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to save agent embed.");
      }

      const nextProfile = data.profile || {};

      setAiChatForm(normalizeAiChatForm(nextProfile.aiChat));
      setProfileUpdatedAt(nextProfile.updatedAt || null);
      showSnackbar({type: "success", message: "Agent embed saved."});
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message || "Unable to save agent embed.",
      });
    } finally {
      setIsSavingAiChat(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="aiSettings" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Agent Settings</h1>
            <p className={styles.muted}>
              Configure the assistant and public embed for this site.
            </p>
          </div>
          <div className={styles.toolbarActions}>
            <a
              className={`${styles.secondaryButton} ${styles.iconTextButton}`}
              href="/"
              rel="noreferrer"
              target="_blank"
            >
              <ExternalLink aria-hidden="true" size={18} strokeWidth={2.2} />
              Preview Agent
            </a>
          </div>
        </div>

        <div className={styles.settingsGrid}>
          <form
            className={`${styles.portfolioPanel} ${styles.collapsiblePanel}`}
            onSubmit={saveSettings}
          >
            <div className={styles.collapsibleHeader}>
              <div className={styles.titleBlock}>
                <h2>Agent settings</h2>
                <p className={styles.muted}>
                  Set the model, instructions, and source context for assistant
                  actions.
                </p>
              </div>
              <div className={styles.collapsibleHeaderActions}>
                <span className={styles.statusBadge}>
                  {form.includeCvContext ? "CV context on" : "CV context off"}
                </span>
                <button
                  aria-controls={SETTINGS_CARD_ID}
                  aria-expanded={settingsExpanded}
                  aria-label={
                    settingsExpanded
                      ? "Collapse agent settings"
                      : "Expand agent settings"
                  }
                  className={`${styles.iconButton} ${styles.collapsibleTrigger}`}
                  title={
                    settingsExpanded
                      ? "Collapse agent settings"
                      : "Expand agent settings"
                  }
                  type="button"
                  onClick={() => toggleCard("settings")}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={`${styles.collapsibleChevron} ${
                      settingsExpanded ? styles.collapsibleChevronOpen : ""
                    }`}
                    size={20}
                    strokeWidth={2.2}
                  />
                </button>
                <button
                  className={styles.button}
                  disabled={isSaving}
                  type="submit"
                >
                  {isSaving ? "Saving..." : "Save settings"}
                </button>
              </div>
            </div>

            {settingsExpanded ? (
              <div className={styles.collapsibleBody} id={SETTINGS_CARD_ID}>
                <div className={styles.aiSettingsFields}>
                  <label className={styles.field}>
                    Model
                    <input
                      list="ai-settings-models"
                      placeholder="gpt-5.5"
                      value={form.model}
                      onChange={(event) =>
                        updateField("model", event.target.value)
                      }
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

                <p className={styles.muted}>
                  Last saved: {formatDate(form.updatedAt)}
                  {form.updatedBy ? ` · ${form.updatedBy}` : ""}
                </p>
              </div>
            ) : null}
          </form>

          <section className={`${styles.portfolioPanel} ${styles.collapsiblePanel}`}>
            <div className={styles.collapsibleHeader}>
              <div className={styles.titleBlock}>
                <h2>Embed your Agent</h2>
                <p className={styles.muted}>
                  Control the public agent widget loaded after external services
                  consent.
                </p>
              </div>
              <div className={styles.collapsibleHeaderActions}>
                <span className={styles.statusBadge}>
                  {aiChatEnabled ? "Enabled" : "Disabled"}
                </span>
                <button
                  aria-controls={EMBED_CARD_ID}
                  aria-expanded={embedExpanded}
                  aria-label={
                    embedExpanded ? "Collapse agent embed" : "Expand agent embed"
                  }
                  className={`${styles.iconButton} ${styles.collapsibleTrigger}`}
                  title={
                    embedExpanded ? "Collapse agent embed" : "Expand agent embed"
                  }
                  type="button"
                  onClick={() => toggleCard("embed")}
                >
                  <ChevronDown
                    aria-hidden="true"
                    className={`${styles.collapsibleChevron} ${
                      embedExpanded ? styles.collapsibleChevronOpen : ""
                    }`}
                    size={20}
                    strokeWidth={2.2}
                  />
                </button>
                <button
                  className={styles.button}
                  disabled={isSavingAiChat}
                  type="button"
                  onClick={() => void saveAiChatIntegration()}
                >
                  {isSavingAiChat ? "Saving..." : "Save embed"}
                </button>
              </div>
            </div>

            {embedExpanded ? (
              <div className={styles.collapsibleBody} id={EMBED_CARD_ID}>
                <label className={styles.featureToggle}>
                  <input
                    checked={aiChatForm.enabled}
                    disabled={isSavingAiChat}
                    type="checkbox"
                    onChange={(event) =>
                      updateAiChatField("enabled", event.target.checked)
                    }
                  />
                  <span className={styles.featureSwitch} aria-hidden="true" />
                  <span className={styles.featureText}>
                    <strong>Public agent widget</strong>
                    <small>
                      {aiChatEnabled
                        ? "The saved agent script loads on public pages after consent."
                        : "The agent script stays disabled until it is switched on and saved."}
                    </small>
                  </span>
                  <span className={styles.featureStatus}>
                    {aiChatEnabled ? "On" : "Off"}
                  </span>
                </label>

                <div
                  className={`${styles.integrationFields} ${styles.chatScriptFields}`}
                >
                  <label className={`${styles.field} ${styles.chatScriptField}`}>
                    Agent embed script tag
                    <textarea
                      maxLength={20000}
                      placeholder="<script async src=&quot;https://example.com/chat.js&quot;></script>"
                      rows={8}
                      spellCheck="false"
                      value={aiChatForm.scriptTag}
                      onChange={(event) =>
                        updateAiChatField("scriptTag", event.target.value)
                      }
                    />
                  </label>
                </div>

                <p className={styles.muted}>
                  Last saved: {formatDate(profileUpdatedAt)}
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}
