import "server-only";

import {unstable_cache} from "next/cache";

import {FALLBACK_LANGUAGE} from "../../lib/languageDetection";
import {supportedLanguages} from "../../lib/translationResources";
import {getDb} from "./mongo";
import {
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  PUBLIC_CACHE_TAGS,
  revalidatePublicTags,
} from "./publicCache";

const SKILLS_COLLECTION = "skills";
const SKILLS_META_ID = "__skills_meta";
const LEGACY_CONTENT_COLLECTION = "site_content";
const LEGACY_PROFILE_ID = "profile_settings";
const MAX_SKILLS = 12;
const MAX_SKILL_DETAIL_LENGTH = 220;
const MAX_SKILL_ID_LENGTH = 80;
const MAX_SKILL_LABEL_LENGTH = 90;
const MAX_SKILL_SCORE = 10;
const DEFAULT_SKILL_SCORE = 5;

class SkillsCollectionError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SkillsCollectionError";
    this.status = status;
  }
}

export {SkillsCollectionError};

function skillsFilter() {
  return {
    $or: [
      {type: "skill"},
      {
        type: {$exists: false},
        _id: {$ne: SKILLS_META_ID},
      },
    ],
  };
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanSkillId(value, fallback, usedIds) {
  const sanitized = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SKILL_ID_LENGTH);
  const base = sanitized && sanitized !== SKILLS_META_ID ? sanitized : fallback;
  let id = base;
  let counter = 2;

  while (usedIds.has(id)) {
    const suffix = `-${counter}`;
    id = `${base.slice(0, MAX_SKILL_ID_LENGTH - suffix.length)}${suffix}`;
    counter += 1;
  }

  usedIds.add(id);
  return id;
}

function normalizeSkillScore(value, fallback = DEFAULT_SKILL_SCORE) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;

  const clampedScore = Math.min(MAX_SKILL_SCORE, Math.max(0, score));
  return Math.round(clampedScore * 10) / 10;
}

export function getDefaultSkills() {
  return [];
}

function getSkillTranslationSource(skill, language) {
  const translations =
    skill?.translations &&
    typeof skill.translations === "object" &&
    !Array.isArray(skill.translations)
      ? skill.translations
      : {};
  const source =
    translations[language] &&
    typeof translations[language] === "object" &&
    !Array.isArray(translations[language])
      ? translations[language]
      : {};

  return {
    label: source.label || source.title || "",
    detail: source.detail || source.description || "",
  };
}

function normalizeSkillTranslations(skill = {}, options = {}) {
  const legacyLabel = cleanText(
    skill.label || skill.title,
    MAX_SKILL_LABEL_LENGTH
  );
  const legacyDetail = cleanText(
    skill.detail || skill.description,
    MAX_SKILL_DETAIL_LENGTH
  );
  const normalized = supportedLanguages.reduce((acc, language) => {
    const source = getSkillTranslationSource(skill, language);

    acc[language] = {
      label: cleanText(source.label, MAX_SKILL_LABEL_LENGTH),
      detail: cleanText(source.detail, MAX_SKILL_DETAIL_LENGTH),
    };
    return acc;
  }, {});
  const fallbackLanguage = supportedLanguages.includes(FALLBACK_LANGUAGE)
    ? FALLBACK_LANGUAGE
    : supportedLanguages[0];

  if (legacyLabel && !normalized[fallbackLanguage]?.label) {
    normalized[fallbackLanguage].label = legacyLabel;
  }

  if (legacyDetail && !normalized[fallbackLanguage]?.detail) {
    normalized[fallbackLanguage].detail = legacyDetail;
  }

  const firstLabel = Object.values(normalized).find(
    (translation) => translation.label
  )?.label;
  const firstDetail = Object.values(normalized).find(
    (translation) => translation.detail
  )?.detail;

  if (!firstLabel) {
    if (options.strict) {
      throw new SkillsCollectionError("Each skill needs at least one title.");
    }

    return null;
  }

  return supportedLanguages.reduce((acc, language) => {
    acc[language] = {
      label: normalized[language].label || firstLabel,
      detail: normalized[language].detail || firstDetail || "",
    };
    return acc;
  }, {});
}

export function normalizeSkills(input, options = {}) {
  if (!Array.isArray(input)) {
    if (options.strict) {
      throw new SkillsCollectionError("Skills must be a list.");
    }

    return [];
  }

  if (options.strict && input.length > MAX_SKILLS) {
    throw new SkillsCollectionError(`Add no more than ${MAX_SKILLS} skills.`);
  }

  const usedIds = new Set();

  return input
    .slice(0, MAX_SKILLS)
    .map((skill, index) => {
      const source =
        skill && typeof skill === "object" && !Array.isArray(skill)
          ? skill
          : {};
      const translations = normalizeSkillTranslations(source, options);

      if (!translations) return null;

      return {
        id: cleanSkillId(
          source.id || source.key || source._id,
          `skill-${index + 1}`,
          usedIds
        ),
        score: normalizeSkillScore(source.score),
        translations,
      };
    })
    .filter(Boolean);
}

function serializeSkillDocuments(documents = []) {
  return normalizeSkills(
    documents.map((document) => ({
      ...document,
      id: document.id || document._id,
    })),
    {useDefaults: false}
  );
}

async function readLegacyProfileSkills(db) {
  const profile = await db
    .collection(LEGACY_CONTENT_COLLECTION)
    .findOne({_id: LEGACY_PROFILE_ID}, {projection: {skills: 1}});
  const migrated = normalizeSkills(profile?.skills, {useDefaults: false});

  return migrated;
}

function buildSkillUpdates(skills, now, user) {
  return skills.map((skill, index) => ({
    updateOne: {
      filter: {_id: skill.id},
      update: {
        $set: {
          order: index,
          score: skill.score,
          translations: skill.translations,
          type: "skill",
          updatedAt: now,
          updatedBy: user?.email || null,
        },
        $setOnInsert: {createdAt: now},
      },
      upsert: true,
    },
  }));
}

async function writeSkills(collection, skills, user) {
  const now = new Date();
  const ids = skills.map((skill) => skill.id);
  const operations = [
    ...buildSkillUpdates(skills, now, user),
    {
      deleteMany: {
        filter: ids.length
          ? {...skillsFilter(), _id: {$nin: ids}}
          : skillsFilter(),
      },
    },
    {
      updateOne: {
        filter: {_id: SKILLS_META_ID},
        update: {
          $set: {
            type: "meta",
            updatedAt: now,
            updatedBy: user?.email || null,
          },
          $setOnInsert: {createdAt: now},
        },
        upsert: true,
      },
    },
  ];

  await collection.bulkWrite(operations, {ordered: true});
}

async function seedSkillsCollection(db, collection) {
  const skills = await readLegacyProfileSkills(db);

  await writeSkills(collection, skills, null);
  return skills;
}

async function readSkillsCollection() {
  const db = await getDb();
  const collection = db.collection(SKILLS_COLLECTION);
  const [meta, documents] = await Promise.all([
    collection.findOne({_id: SKILLS_META_ID}),
    collection.find(skillsFilter()).sort({order: 1, _id: 1}).toArray(),
  ]);

  if (documents.length) {
    if (!meta) {
      await collection.updateOne(
        {_id: SKILLS_META_ID},
        {
          $set: {type: "meta", updatedAt: new Date()},
          $setOnInsert: {createdAt: new Date()},
        },
        {upsert: true}
      );
    }

    return serializeSkillDocuments(documents);
  }

  if (meta) {
    return [];
  }

  return seedSkillsCollection(db, collection);
}

export const getSkills = unstable_cache(
  readSkillsCollection,
  ["public-skills"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.skills],
  }
);

export async function saveSkills(input = [], user) {
  const skills = normalizeSkills(input, {strict: true});
  const db = await getDb();
  const collection = db.collection(SKILLS_COLLECTION);

  await writeSkills(collection, skills, user);
  revalidatePublicTags(PUBLIC_CACHE_TAGS.skills);

  return skills;
}
