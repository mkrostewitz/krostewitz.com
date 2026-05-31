import "server-only";

import {
  buildResourcesFromTranslations,
  resources,
  supportedLanguages,
} from "../../lib/translationResources";
import {getDb} from "./mongo";
import {getSiteProfile} from "./siteProfile";

const CONTENT_COLLECTION = "site_content";
const TRANSLATIONS_ID = "translations";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function getProfilePlaceholders(profile = {}) {
  const firstName = String(profile.name?.firstName || "").trim();
  const lastName = String(profile.name?.lastName || "").trim();
  const profileName =
    String(profile.name?.fullName || "").trim() ||
    [firstName, lastName].filter(Boolean).join(" ");

  return {
    firstName,
    lastName,
    profileName,
  };
}

function hydrateProfilePlaceholders(value, placeholders) {
  if (typeof value === "string") {
    return value.replace(
      /\{\{\s*(firstName|lastName|profileName)\s*\}\}/g,
      (match, key) => placeholders[key] || match
    );
  }

  if (Array.isArray(value)) {
    return value.map((item) => hydrateProfilePlaceholders(item, placeholders));
  }

  if (isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        hydrateProfilePlaceholders(item, placeholders),
      ])
    );
  }

  return value;
}

export function getDefaultTranslations() {
  return supportedLanguages.reduce((acc, language) => {
    acc[language] = clone(resources[language].translation);
    return acc;
  }, {});
}

export function validateTranslations(translations) {
  if (!isPlainObject(translations)) {
    return "Translations must be a JSON object keyed by language.";
  }

  for (const language of supportedLanguages) {
    if (!isPlainObject(translations[language])) {
      return `Missing translation object for "${language}".`;
    }
  }

  return null;
}

export async function getStoredTranslations() {
  const db = await getDb();
  const document = await db
    .collection(CONTENT_COLLECTION)
    .findOne({_id: TRANSLATIONS_ID});

  return document?.translations || null;
}

export async function getMergedTranslations() {
  const defaults = getDefaultTranslations();
  const stored = await getStoredTranslations();

  if (!stored) return defaults;

  return supportedLanguages.reduce((acc, language) => {
    acc[language] = isPlainObject(stored[language])
      ? stored[language]
      : defaults[language];
    return acc;
  }, {});
}

export async function getRuntimeTranslationResources() {
  const translations = await getMergedTranslations();
  const profile = await getSiteProfile();
  const hydratedTranslations = hydrateProfilePlaceholders(
    translations,
    getProfilePlaceholders(profile)
  );

  return buildResourcesFromTranslations(hydratedTranslations);
}

export async function saveTranslations(translations, user) {
  const validationError = validateTranslations(translations);
  if (validationError) {
    throw new Error(validationError);
  }

  const db = await getDb();
  const now = new Date();

  await db.collection(CONTENT_COLLECTION).updateOne(
    {_id: TRANSLATIONS_ID},
    {
      $set: {
        translations,
        updatedAt: now,
        updatedBy: user?.email || null,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {upsert: true}
  );

  return {
    translations,
    updatedAt: now,
    updatedBy: user?.email || null,
  };
}
