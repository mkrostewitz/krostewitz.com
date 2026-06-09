"use client";

import {ArrowDown, ArrowUp, Plus, Trash2} from "lucide-react";
import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import {FALLBACK_LANGUAGE} from "@/lib/languageDetection";
import {SITE_LANGUAGES} from "@/lib/siteLanguages";
import {loadRuntimeTranslations} from "../../../lib/i18n";
import {useLoadingState} from "../../components/loading/LoadingProvider";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const DEFAULT_SKILL_SCORE = 5;
const MAX_SKILL_SCORE = 10;

function formatDate(value, locale, emptyLabel) {
  if (!value) return emptyLabel;

  return new Intl.DateTimeFormat(locale || "en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function createSkillId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createEmptySkillTranslations() {
  return SITE_LANGUAGES.reduce((acc, language) => {
    acc[language.code] = {label: "", detail: ""};
    return acc;
  }, {});
}

function createEmptySkill() {
  return {
    id: createSkillId(),
    score: DEFAULT_SKILL_SCORE,
    translations: createEmptySkillTranslations(),
  };
}

function normalizeSkillScore(value) {
  const score = Number(value);
  if (!Number.isFinite(score)) return DEFAULT_SKILL_SCORE;

  const clampedScore = Math.min(MAX_SKILL_SCORE, Math.max(0, score));
  return Math.round(clampedScore * 10) / 10;
}

function normalizeSkillForm(skill = {}, index = 0) {
  const translations =
    skill?.translations &&
    typeof skill.translations === "object" &&
    !Array.isArray(skill.translations)
      ? skill.translations
      : {};
  const fallbackTranslation =
    translations[FALLBACK_LANGUAGE] &&
    typeof translations[FALLBACK_LANGUAGE] === "object"
      ? translations[FALLBACK_LANGUAGE]
      : {};
  const fallbackLabel =
    fallbackTranslation.label || skill.label || skill.title || "";
  const fallbackDetail =
    fallbackTranslation.detail || skill.detail || skill.description || "";

  return {
    id: String(skill.id || skill.key || `skill-${index + 1}`),
    score: normalizeSkillScore(skill.score),
    translations: SITE_LANGUAGES.reduce((acc, language) => {
      const translation =
        translations[language.code] &&
        typeof translations[language.code] === "object"
          ? translations[language.code]
          : {};

      acc[language.code] = {
        label: String(
          translation.label || translation.title || fallbackLabel
        ).trim(),
        detail: String(
          translation.detail || translation.description || fallbackDetail
        ).trim(),
      };
      return acc;
    }, {}),
  };
}

function normalizeSkillsForm(skills = []) {
  return Array.isArray(skills)
    ? skills.map((skill, index) => normalizeSkillForm(skill, index))
    : [];
}

function getSkillPreviewLabel(skill, fallbackLabel) {
  const translations = skill.translations || {};

  return (
    translations[FALLBACK_LANGUAGE]?.label ||
    Object.values(translations).find((translation) => translation?.label)?.label ||
    fallbackLabel
  );
}

export default function SkillsSettings({user}) {
  const {t, i18n} = useTranslation(undefined, {keyPrefix: "admin.profile"});
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const locale = i18n.resolvedLanguage || i18n.language || "en";
  const notSavedLabel = t("status.notSaved");
  const [skillsEnabled, setSkillsEnabled] = useState(true);
  const [skillsForm, setSkillsForm] = useState(() => normalizeSkillsForm([]));
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useLoadingState({
    isLoading,
    label: t("status.loading"),
    type: "page",
  });
  useLoadingState({
    isLoading: isSaving,
    label: t("actions.saving"),
    type: "action",
  });

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSkillsSettings() {
      try {
        const [profileResponse, skillsResponse] = await Promise.all([
          fetch("/api/admin/profile", {cache: "no-store"}),
          fetch("/api/admin/skills", {cache: "no-store"}),
        ]);
        const [profileData, skillsData] = await Promise.all([
          profileResponse.json().catch(() => ({})),
          skillsResponse.json().catch(() => ({})),
        ]);

        if (!profileResponse.ok) {
          throw new Error(profileData.error || t("errors.loadProfile"));
        }

        if (!skillsResponse.ok) {
          throw new Error(skillsData.error || t("errors.loadProfile"));
        }

        const nextProfile = profileData.profile || {};

        if (!cancelled) {
          setSkillsEnabled(nextProfile.skillsEnabled !== false);
          setSkillsForm(normalizeSkillsForm(skillsData.skills));
          setLastSavedAt(nextProfile.updatedAt || null);
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) {
          showSnackbar({
            type: "error",
            message: error.message || t("errors.loadProfile"),
          });
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadSkillsSettings();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar, t]);

  function addSkill() {
    setSkillsForm((current) => [...current, createEmptySkill()]);
  }

  function removeSkill(skillId) {
    setSkillsForm((current) =>
      current.filter((skill) => skill.id !== skillId)
    );
  }

  function moveSkill(skillId, direction) {
    setSkillsForm((current) => {
      const index = current.findIndex((skill) => skill.id === skillId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  }

  function handleSkillScore(skillId, value) {
    setSkillsForm((current) =>
      current.map((skill) =>
        skill.id === skillId
          ? {...skill, score: normalizeSkillScore(value)}
          : skill
      )
    );
  }

  function handleSkillTranslation(skillId, language, field, value) {
    setSkillsForm((current) =>
      current.map((skill) =>
        skill.id === skillId
          ? {
              ...skill,
              translations: {
                ...(skill.translations || {}),
                [language]: {
                  ...(skill.translations?.[language] || {}),
                  [field]: value,
                },
              },
            }
          : skill
      )
    );
  }

  async function saveSkillsVisibility(value) {
    const previousValue = skillsEnabled;

    setSkillsEnabled(value);
    closeSnackbar();
    setIsSaving(true);

    try {
      const response = await fetch("/api/admin/profile", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({skillsEnabled: value}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("errors.saveSkillsVisibility"));
      }

      const nextProfile = data.profile || {};

      setSkillsEnabled(nextProfile.skillsEnabled !== false);
      setLastSavedAt(nextProfile.updatedAt || null);
      showSnackbar({
        type: "success",
        message: t(
          nextProfile.skillsEnabled === false
            ? "status.skillsHidden"
            : "status.skillsVisible"
        ),
      });
    } catch (error) {
      setSkillsEnabled(previousValue);
      showSnackbar({
        type: "error",
        message: error.message || t("errors.saveSkillsVisibility"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function saveSkills() {
    setIsSaving(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/skills", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({skills: skillsForm}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || t("errors.saveSkills"));
      }

      setSkillsForm(normalizeSkillsForm(data.skills));
      setLastSavedAt(new Date().toISOString());
      showSnackbar({
        type: "success",
        message: t("status.skillsSaved"),
      });
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message || t("errors.saveSkills"),
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="skills" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>{t("sections.skills.title")}</h1>
            <p className={styles.muted}>{t("sections.skills.description")}</p>
          </div>
        </div>

        <div className={styles.profileGrid}>
          <section className={`${styles.profilePanel} ${styles.profilePanelFull}`}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("skillsVisibility.title")}</h2>
                <p className={styles.muted}>{t("sections.public.description")}</p>
              </div>
            </div>

            <label className={styles.featureToggle}>
              <input
                checked={skillsEnabled}
                disabled={isSaving}
                type="checkbox"
                onChange={(event) =>
                  void saveSkillsVisibility(event.target.checked)
                }
              />
              <span className={styles.featureSwitch} aria-hidden="true" />
              <span className={styles.featureText}>
                <strong>{t("skillsVisibility.title")}</strong>
                <small>
                  {skillsEnabled
                    ? t("skillsVisibility.visibleDescription")
                    : t("skillsVisibility.hiddenDescription")}
                </small>
              </span>
              <span className={styles.featureStatus}>
                {skillsEnabled
                  ? t("skillsVisibility.visible")
                  : t("skillsVisibility.hidden")}
              </span>
            </label>
          </section>

          <section className={`${styles.profilePanel} ${styles.profilePanelFull}`}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>{t("sections.skills.title")}</h2>
                <p className={styles.muted}>
                  {t("sections.skills.description")}
                </p>
              </div>
              <button
                className={`${styles.secondaryButton} ${styles.iconTextButton}`}
                disabled={isSaving}
                type="button"
                onClick={addSkill}
              >
                <Plus aria-hidden="true" size={17} strokeWidth={2.3} />
                {t("actions.addSkill")}
              </button>
            </div>

            <div className={styles.skillEditorList}>
              {skillsForm.map((skill, index) => (
                <article className={styles.skillEditorCard} key={skill.id}>
                  <div className={styles.skillEditorHeader}>
                    <div className={styles.titleBlock}>
                      <h3>
                        {getSkillPreviewLabel(
                          skill,
                          t("skills.newSkill", {number: index + 1})
                        )}
                      </h3>
                      <p className={styles.muted}>
                        {t("skills.scoreSummary", {
                          score: skill.score,
                          max: MAX_SKILL_SCORE,
                        })}
                      </p>
                    </div>

                    <div className={styles.skillEditorControls}>
                      <button
                        aria-label={t("actions.moveSkillUp")}
                        className={styles.iconButton}
                        disabled={isSaving || index === 0}
                        title={t("actions.moveSkillUp")}
                        type="button"
                        onClick={() => moveSkill(skill.id, -1)}
                      >
                        <ArrowUp aria-hidden="true" size={17} strokeWidth={2.3} />
                      </button>
                      <button
                        aria-label={t("actions.moveSkillDown")}
                        className={styles.iconButton}
                        disabled={isSaving || index === skillsForm.length - 1}
                        title={t("actions.moveSkillDown")}
                        type="button"
                        onClick={() => moveSkill(skill.id, 1)}
                      >
                        <ArrowDown
                          aria-hidden="true"
                          size={17}
                          strokeWidth={2.3}
                        />
                      </button>
                      <button
                        aria-label={t("actions.removeSkill")}
                        className={`${styles.iconButton} ${styles.dangerButton}`}
                        disabled={isSaving}
                        title={t("actions.removeSkill")}
                        type="button"
                        onClick={() => removeSkill(skill.id)}
                      >
                        <Trash2 aria-hidden="true" size={17} strokeWidth={2.3} />
                      </button>
                    </div>
                  </div>

                  <div className={styles.skillScoreRow}>
                    <label className={`${styles.field} ${styles.skillRangeField}`}>
                      <span className={styles.fieldLabel}>
                        {t("fields.skillScore")}
                      </span>
                      <input
                        max={MAX_SKILL_SCORE}
                        min="0"
                        step="0.1"
                        type="range"
                        value={skill.score}
                        onChange={(event) =>
                          handleSkillScore(skill.id, event.target.value)
                        }
                      />
                    </label>
                    <label className={styles.field}>
                      <span className={styles.fieldLabel}>
                        {t("fields.skillScoreValue")}
                      </span>
                      <input
                        inputMode="numeric"
                        max={MAX_SKILL_SCORE}
                        min="0"
                        step="0.1"
                        type="number"
                        value={skill.score}
                        onChange={(event) =>
                          handleSkillScore(skill.id, event.target.value)
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.skillLanguageGrid}>
                    {SITE_LANGUAGES.map((language) => (
                      <div
                        className={styles.skillLanguagePanel}
                        key={`${skill.id}-${language.code}`}
                      >
                        <h4>{language.label}</h4>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>
                            {t("fields.skillLabel")}
                          </span>
                          <input
                            maxLength={90}
                            value={skill.translations?.[language.code]?.label || ""}
                            onChange={(event) =>
                              handleSkillTranslation(
                                skill.id,
                                language.code,
                                "label",
                                event.target.value
                              )
                            }
                          />
                        </label>
                        <label className={styles.field}>
                          <span className={styles.fieldLabel}>
                            {t("fields.skillDetail")}
                          </span>
                          <textarea
                            maxLength={220}
                            rows={3}
                            value={skill.translations?.[language.code]?.detail || ""}
                            onChange={(event) =>
                              handleSkillTranslation(
                                skill.id,
                                language.code,
                                "detail",
                                event.target.value
                              )
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                {t("fields.lastSaved", {
                  date: formatDate(lastSavedAt, locale, notSavedLabel),
                })}
              </p>
              <div className={styles.buttonRow}>
                <button
                  className={`${styles.secondaryButton} ${styles.iconTextButton}`}
                  disabled={isSaving}
                  type="button"
                  onClick={addSkill}
                >
                  <Plus aria-hidden="true" size={17} strokeWidth={2.3} />
                  {t("actions.addSkill")}
                </button>
                <button
                  className={styles.button}
                  disabled={isSaving}
                  type="button"
                  onClick={() => void saveSkills()}
                >
                  {isSaving ? t("actions.saving") : t("actions.saveSkills")}
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
