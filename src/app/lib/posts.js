import "server-only";

import {ObjectId} from "mongodb";
import {unstable_cache} from "next/cache";
import sanitizeHtml from "sanitize-html";

import {FALLBACK_LANGUAGE} from "../../lib/languageDetection";
import {
  getSupportedSiteLanguage,
  SITE_LANGUAGE_CODES,
} from "../../lib/siteLanguages";
import {getDb} from "./mongo";
import {
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  PUBLIC_CACHE_TAGS,
  revalidatePublicTags,
} from "./publicCache";

const POSTS_COLLECTION = "posts";

export const POST_STATUSES = ["draft", "published", "archived"];

const RICH_TEXT_TAGS = [
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "code",
  "pre",
  "hr",
  "table",
  "tbody",
  "thead",
  "tfoot",
  "tr",
  "th",
  "td",
  "colgroup",
  "col",
  "div",
  "span",
];

let indexPromise = null;

export class PostValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "PostValidationError";
    this.status = status;
  }
}

function getPostsCollection(db) {
  return db.collection(POSTS_COLLECTION);
}

async function ensurePostIndexes(db) {
  if (!indexPromise) {
    const posts = getPostsCollection(db);
    indexPromise = Promise.all([
      posts.createIndex({slug: 1}, {unique: true}),
      posts.createIndex({status: 1, publishedAt: -1}),
      posts.createIndex({"categories.slug": 1, status: 1, publishedAt: -1}),
      posts.createIndex({updatedAt: -1}),
    ]).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

function revalidatePublicPosts() {
  revalidatePublicTags(PUBLIC_CACHE_TAGS.posts);
}

function isPostObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value || ""));
}

function toObjectId(value) {
  if (!isPostObjectId(value)) {
    throw new PostValidationError("Invalid post id.");
  }

  return new ObjectId(String(value));
}

function toIsoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function cleanText(value, maxLength = 220) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizePostHtml(value) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: RICH_TEXT_TAGS,
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      table: ["style"],
      col: ["style"],
      th: ["colspan", "rowspan", "colwidth", "style"],
      td: ["colspan", "rowspan", "colwidth", "style"],
    },
    allowedStyles: {
      table: {
        width: [/^\d+(?:\.\d+)?px$/, /^\d+(?:\.\d+)?%$/],
        "min-width": [/^\d+(?:\.\d+)?px$/],
      },
      col: {
        width: [/^\d+(?:\.\d+)?px$/, /^\d+(?:\.\d+)?%$/],
        "min-width": [/^\d+(?:\.\d+)?px$/],
      },
      th: {
        "text-align": [/^(left|center|right)$/],
      },
      td: {
        "text-align": [/^(left|center|right)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {
      a(tagName, attribs) {
        const href = String(attribs.href || "").trim();

        if (!href) {
          return {
            tagName: "span",
            attribs: {},
          };
        }

        return {
          tagName,
          attribs: {
            href,
            target: "_blank",
            rel: "noopener noreferrer",
          },
        };
      },
      b: "strong",
      i: "em",
    },
  }).trim();
}

function slugify(value) {
  const slug = String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "post";
}

function hasOwnProperty(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function createEmptyTranslation() {
  return {
    title: "",
    summary: "",
    contentHtml: "",
  };
}

function normalizeTranslationInput(value = {}) {
  const contentHtml = sanitizePostHtml(value.contentHtml);
  const contentText = cleanText(contentHtml, 100000);

  return {
    title: cleanText(value.title, 140),
    summary: cleanText(value.summary || contentText, 260),
    contentHtml,
  };
}

function hasTranslationValue(translation) {
  if (!translation) return false;

  return Boolean(
    cleanText(translation.title, 140) ||
      cleanText(translation.summary, 260) ||
      cleanText(translation.contentHtml, 100000)
  );
}

function hasPublishableTranslation(translation) {
  return Boolean(
    cleanText(translation?.title, 140).length >= 2 &&
      cleanText(translation?.contentHtml, 100000).length >= 10
  );
}

function hasTitledTranslation(translation) {
  return cleanText(translation?.title, 140).length >= 2;
}

function normalizeTranslations(input = {}) {
  const rawTranslations =
    input.translations && typeof input.translations === "object"
      ? input.translations
      : {};
  const fallbackInput = {
    title: input.title,
    summary: input.summary,
    contentHtml: input.contentHtml,
  };
  const translations = {};

  for (const language of SITE_LANGUAGE_CODES) {
    const rawTranslation =
      rawTranslations[language] && typeof rawTranslations[language] === "object"
        ? rawTranslations[language]
        : {};
    const source =
      language === FALLBACK_LANGUAGE && !hasTranslationValue(rawTranslation)
        ? fallbackInput
        : rawTranslation;

    translations[language] = hasTranslationValue(source)
      ? normalizeTranslationInput(source)
      : createEmptyTranslation();
  }

  if (
    !Object.values(translations).some(hasTranslationValue) &&
    hasTranslationValue(fallbackInput)
  ) {
    translations[FALLBACK_LANGUAGE] = normalizeTranslationInput(fallbackInput);
  }

  return translations;
}

function getFirstTranslation(translations, predicate) {
  const orderedLanguages = [
    FALLBACK_LANGUAGE,
    ...SITE_LANGUAGE_CODES.filter((language) => language !== FALLBACK_LANGUAGE),
  ];

  for (const language of orderedLanguages) {
    const translation = translations[language];

    if (predicate(translation)) {
      return {language, translation};
    }
  }

  return {language: FALLBACK_LANGUAGE, translation: createEmptyTranslation()};
}

function getPrimaryTranslation(translations) {
  const fallbackTranslation = translations[FALLBACK_LANGUAGE];

  if (hasTitledTranslation(fallbackTranslation)) return fallbackTranslation;

  const publishable = getFirstTranslation(
    translations,
    hasPublishableTranslation
  ).translation;

  if (hasPublishableTranslation(publishable)) return publishable;

  const titled = getFirstTranslation(translations, hasTitledTranslation)
    .translation;

  if (hasTitledTranslation(titled)) return titled;

  const populated = getFirstTranslation(translations, hasTranslationValue)
    .translation;

  return hasTranslationValue(populated) ? populated : createEmptyTranslation();
}

function getLocalizedTranslation(translations, language) {
  const supportedLanguage =
    getSupportedSiteLanguage(language) || FALLBACK_LANGUAGE;
  const requestedTranslation = translations[supportedLanguage];

  if (hasTranslationValue(requestedTranslation)) {
    return requestedTranslation;
  }

  return getPrimaryTranslation(translations);
}

function normalizePostSlugInput(input = {}) {
  if (!hasOwnProperty(input, "slug")) return undefined;

  const rawSlug = String(input.slug || "").trim();
  return rawSlug ? slugify(rawSlug) : "";
}

function normalizeCategorySlug(value) {
  const rawValue = String(value || "").trim();
  return rawValue ? slugify(rawValue) : "";
}

async function generateUniqueSlug(db, title, excludeId = null) {
  const posts = getPostsCollection(db);
  const baseSlug = slugify(title);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const query = excludeId
      ? {slug: candidate, _id: {$ne: excludeId}}
      : {slug: candidate};
    const existing = await posts.findOne(query, {projection: {_id: 1}});

    if (!existing) return candidate;

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

async function assertUniqueSlug(db, slug, excludeId = null) {
  const posts = getPostsCollection(db);
  const query = excludeId ? {slug, _id: {$ne: excludeId}} : {slug};
  const existing = await posts.findOne(query, {projection: {_id: 1}});

  if (existing) {
    throw new PostValidationError("That post slug is already in use.", 409);
  }
}

function normalizeStatus(value) {
  const status = String(value || "draft").toLowerCase();

  if (!POST_STATUSES.includes(status)) {
    throw new PostValidationError("Invalid post status.");
  }

  return status;
}

function normalizeCategories(value) {
  const source = Array.isArray(value)
    ? value
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
  const categories = [];
  const seen = new Set();

  for (const item of source) {
    const rawLabel =
      typeof item === "object" && item !== null ? item.label || item.name : item;
    const label = cleanText(rawLabel, 50);
    const slug = slugify(
      typeof item === "object" && item !== null ? item.slug || label : label
    );

    if (!label || seen.has(slug)) continue;

    categories.push({label, slug});
    seen.add(slug);

    if (categories.length >= 12) break;
  }

  return categories;
}

function normalizePublishedAt(input = {}) {
  if (!hasOwnProperty(input, "publishedAt")) return undefined;

  if (
    input.publishedAt === null ||
    String(input.publishedAt || "").trim() === ""
  ) {
    return null;
  }

  const date = new Date(input.publishedAt);

  if (Number.isNaN(date.getTime())) {
    throw new PostValidationError("Published date is invalid.");
  }

  return date;
}

function normalizeMedia(value) {
  if (!value) return null;

  if (typeof value !== "object" || Array.isArray(value)) {
    throw new PostValidationError("Media must be an object.");
  }

  const type = String(value.type || "").toLowerCase();
  const url = String(value.url || "").trim();

  if (!url || !["image", "video"].includes(type)) {
    throw new PostValidationError("Media must include an image or video URL.");
  }

  return {
    type,
    url,
    key: value.key ? String(value.key) : null,
    mimeType: value.mimeType ? String(value.mimeType) : null,
    fileName: value.fileName ? String(value.fileName) : null,
    size: Number.isFinite(Number(value.size)) ? Number(value.size) : null,
  };
}

function serializeLinkedInShares(value) {
  return (Array.isArray(value) ? value : [])
    .filter((share) => share && typeof share === "object")
    .map((share) => ({
      provider: "linkedin",
      target: share.target || "personal_profile",
      language: share.language || null,
      scheduledJobId: share.scheduledJobId || "",
      postUrn: share.postUrn || "",
      postUrl: share.postUrl || "",
      sharedPostUrl: share.sharedPostUrl || "",
      commentary: share.commentary || "",
      media: share.media
        ? {
            imageUrn: share.media.imageUrn || "",
            mimeType: share.media.mimeType || "",
            sourceUrl: share.media.sourceUrl || "",
          }
        : null,
      account: share.account
        ? {
            sub: share.account.sub || "",
            email: share.account.email || "",
            name: share.account.name || "",
            picture: share.account.picture || "",
          }
        : null,
      sharedAt: toIsoDate(share.sharedAt),
      sharedBy: share.sharedBy || null,
    }))
    .sort((left, right) => {
      const leftTime = left.sharedAt ? new Date(left.sharedAt).getTime() : 0;
      const rightTime = right.sharedAt ? new Date(right.sharedAt).getTime() : 0;
      return rightTime - leftTime;
    });
}

function serializeLinkedInShareSchedules(value) {
  return (Array.isArray(value) ? value : [])
    .filter((schedule) => schedule && typeof schedule === "object")
    .map((schedule) => ({
      provider: "linkedin",
      jobId: schedule.jobId || "",
      target: schedule.target || "personal_profile",
      language: schedule.language || null,
      commentary: schedule.commentary || "",
      includeImage: schedule.includeImage === true,
      status: schedule.status || "scheduled",
      scheduledAt: toIsoDate(schedule.scheduledAt),
      scheduledTimeZone: schedule.scheduledTimeZone || "",
      processingStartedAt: toIsoDate(schedule.processingStartedAt),
      publishedAt: toIsoDate(schedule.publishedAt),
      linkedInPostUrn: schedule.linkedInPostUrn || "",
      linkedInPostUrl: schedule.linkedInPostUrl || "",
      failedAt: toIsoDate(schedule.failedAt),
      canceledAt: toIsoDate(schedule.canceledAt),
      canceledBy: schedule.canceledBy || null,
      failure: schedule.failure || "",
      createdAt: toIsoDate(schedule.createdAt),
      createdBy: schedule.createdBy || null,
      updatedAt: toIsoDate(schedule.updatedAt),
      updatedBy: schedule.updatedBy || null,
      account: schedule.account
        ? {
            sub: schedule.account.sub || "",
            email: schedule.account.email || "",
            name: schedule.account.name || "",
            picture: schedule.account.picture || "",
          }
        : null,
    }))
    .sort((left, right) => {
      const leftTime = left.scheduledAt ? new Date(left.scheduledAt).getTime() : 0;
      const rightTime = right.scheduledAt
        ? new Date(right.scheduledAt).getTime()
        : 0;
      return leftTime - rightTime;
    });
}

function serializeLinkedInShareAttempts(value) {
  return (Array.isArray(value) ? value : [])
    .filter((attempt) => attempt && typeof attempt === "object")
    .map((attempt) => ({
      provider: "linkedin",
      attemptType: attempt.attemptType || "immediate",
      target: attempt.target || "personal_profile",
      language: attempt.language || null,
      commentary: attempt.commentary || "",
      includeImage: attempt.includeImage === true,
      status: attempt.status || "failed",
      scheduledJobId: attempt.scheduledJobId || "",
      attemptedAt: toIsoDate(attempt.attemptedAt),
      failedAt: toIsoDate(attempt.failedAt),
      failure: attempt.failure || "",
      createdAt: toIsoDate(attempt.createdAt),
      createdBy: attempt.createdBy || null,
      account: attempt.account
        ? {
            sub: attempt.account.sub || "",
            email: attempt.account.email || "",
            name: attempt.account.name || "",
            picture: attempt.account.picture || "",
          }
        : null,
    }))
    .sort((left, right) => {
      const leftTime = new Date(
        left.failedAt || left.attemptedAt || left.createdAt || 0
      ).getTime();
      const rightTime = new Date(
        right.failedAt || right.attemptedAt || right.createdAt || 0
      ).getTime();
      return rightTime - leftTime;
    });
}

function normalizePostInput(input = {}) {
  const translations = normalizeTranslations(input);
  const primaryTranslation = getPrimaryTranslation(translations);
  const title = cleanText(primaryTranslation.title, 140);

  if (title.length < 2) {
    throw new PostValidationError("Post title is required.");
  }

  const status = normalizeStatus(input.status);

  if (
    status === "published" &&
    !Object.values(translations).some(hasPublishableTranslation)
  ) {
    throw new PostValidationError("Published posts need post content.");
  }

  return {
    title,
    slug: normalizePostSlugInput(input),
    status,
    summary: cleanText(primaryTranslation.summary, 260),
    categories: normalizeCategories(input.categories),
    contentHtml: primaryTranslation.contentHtml,
    translations,
    media: normalizeMedia(input.media),
    publishedAt: normalizePublishedAt(input),
  };
}

export function serializePost(document, options = {}) {
  if (!document) return null;

  const includeContent = options.includeContent !== false;
  const translations = normalizeTranslations({
    title: document.title,
    summary: document.summary,
    contentHtml: document.contentHtml,
    translations: document.translations,
  });
  const localizedTranslation = getLocalizedTranslation(
    translations,
    options.language
  );
  const post = {
    id: String(document._id),
    title: localizedTranslation.title || "",
    slug: document.slug || "",
    summary: localizedTranslation.summary || "",
    categories: normalizeCategories(document.categories),
    status: document.status || "draft",
    media: document.media || null,
    createdAt: toIsoDate(document.createdAt),
    updatedAt: toIsoDate(document.updatedAt),
    publishedAt: toIsoDate(document.publishedAt),
  };

  if (includeContent) {
    post.contentHtml = localizedTranslation.contentHtml || "";
  }

  if (options.includeAdmin) {
    post.authorEmail = document.authorEmail || null;
    post.updatedBy = document.updatedBy || null;
    post.translations = translations;
    post.linkedinShares = serializeLinkedInShares(document.linkedinShares);
    post.linkedinShareSchedules = serializeLinkedInShareSchedules(
      document.linkedinShareSchedules
    );
    post.linkedinShareAttempts = serializeLinkedInShareAttempts(
      document.linkedinShareAttempts
    );
  }

  return post;
}

export async function getAdminPosts(filters = {}) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const query = {};
  if (filters.status && POST_STATUSES.includes(filters.status)) {
    query.status = filters.status;
  }

  const posts = await getPostsCollection(db)
    .find(query)
    .sort({updatedAt: -1})
    .toArray();

  return posts.map((post) =>
    serializePost(post, {includeContent: true, includeAdmin: true})
  );
}

export async function getAdminPostById(postId) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const post = await getPostsCollection(db).findOne({_id: toObjectId(postId)});
  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function createPost(input, user) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const posts = getPostsCollection(db);
  const normalized = normalizePostInput(input);
  const now = new Date();
  const slug = normalized.slug || (await generateUniqueSlug(db, normalized.title));

  if (normalized.slug) {
    await assertUniqueSlug(db, slug);
  }

  const document = {
    title: normalized.title,
    slug,
    status: normalized.status,
    summary: normalized.summary,
    categories: normalized.categories,
    contentHtml: normalized.contentHtml,
    translations: normalized.translations,
    media: normalized.media,
    authorEmail: user?.email || null,
    updatedBy: user?.email || null,
    createdAt: now,
    updatedAt: now,
    publishedAt:
      normalized.status === "published" ? normalized.publishedAt || now : null,
  };

  const result = await posts.insertOne(document);
  const post = await posts.findOne({_id: result.insertedId});

  revalidatePublicPosts();

  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function updatePost(postId, input, user) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const posts = getPostsCollection(db);
  const _id = toObjectId(postId);
  const existing = await posts.findOne({_id});

  if (!existing) {
    throw new PostValidationError("Post not found.", 404);
  }

  const normalized = normalizePostInput(input);
  const now = new Date();
  const update = {
    title: normalized.title,
    status: normalized.status,
    summary: normalized.summary,
    categories: normalized.categories,
    contentHtml: normalized.contentHtml,
    translations: normalized.translations,
    media: normalized.media,
    updatedAt: now,
    updatedBy: user?.email || null,
  };

  if (normalized.slug !== undefined) {
    const slug =
      normalized.slug || (await generateUniqueSlug(db, normalized.title, _id));
    await assertUniqueSlug(db, slug, _id);
    update.slug = slug;
  }

  if (normalized.publishedAt !== undefined) {
    update.publishedAt = normalized.publishedAt;
  } else if (
    normalized.status === "published" &&
    existing.status !== "published"
  ) {
    update.publishedAt = now;
  } else if (normalized.status !== "published" && !existing.publishedAt) {
    update.publishedAt = null;
  }

  if (normalized.status === "published" && !update.publishedAt) {
    update.publishedAt = existing.publishedAt || now;
  }

  const result = await posts.findOneAndUpdate(
    {_id},
    {$set: update},
    {returnDocument: "after"}
  );
  const post = result?.value || result;

  revalidatePublicPosts();

  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function recordPostLinkedInShare(postId, share = {}, user) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const _id = toObjectId(postId);
  const now = new Date();
  const document = {
    provider: "linkedin",
    target: String(share.target || "personal_profile"),
    language: share.language ? String(share.language) : null,
    scheduledJobId: share.scheduledJobId ? String(share.scheduledJobId) : "",
    postUrn: String(share.postUrn || ""),
    postUrl: String(share.postUrl || ""),
    sharedPostUrl: String(share.sharedPostUrl || ""),
    commentary: String(share.commentary || "").slice(0, 3000),
    media: share.media
      ? {
          imageUrn: String(share.media.imageUrn || ""),
          mimeType: String(share.media.mimeType || ""),
          sourceUrl: String(share.media.sourceUrl || ""),
        }
      : null,
    account: share.account
      ? {
          sub: String(share.account.sub || ""),
          email: String(share.account.email || ""),
          name: String(share.account.name || ""),
          picture: String(share.account.picture || ""),
        }
      : null,
    sharedAt: share.sharedAt instanceof Date ? share.sharedAt : now,
    sharedBy: user?.email || null,
  };
  const result = await getPostsCollection(db).findOneAndUpdate(
    {_id},
    {
      $set: {
        updatedAt: now,
        updatedBy: user?.email || null,
        lastLinkedInShare: document,
      },
      $push: {
        linkedinShares: {
          $each: [document],
          $position: 0,
          $slice: 10,
        },
      },
    },
    {returnDocument: "after"}
  );
  const post = result?.value || result;

  if (!post) {
    throw new PostValidationError("Post not found.", 404);
  }

  revalidatePublicPosts();

  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function recordPostLinkedInShareSchedule(postId, schedule = {}, user) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const _id = toObjectId(postId);
  const now = new Date();
  const document = {
    provider: "linkedin",
    jobId: String(schedule.jobId || ""),
    target: String(schedule.target || "personal_profile"),
    language: schedule.language ? String(schedule.language) : null,
    commentary: String(schedule.commentary || ""),
    includeImage: schedule.includeImage === true,
    status: "scheduled",
    scheduledAt:
      schedule.scheduledAt instanceof Date ? schedule.scheduledAt : now,
    scheduledTimeZone: String(schedule.scheduledTimeZone || ""),
    account: schedule.account
      ? {
          sub: String(schedule.account.sub || ""),
          email: String(schedule.account.email || ""),
          name: String(schedule.account.name || ""),
          picture: String(schedule.account.picture || ""),
        }
      : null,
    createdAt: now,
    createdBy: user?.email || null,
    updatedAt: now,
    updatedBy: user?.email || null,
  };
  const result = await getPostsCollection(db).findOneAndUpdate(
    {_id},
    {
      $set: {
        updatedAt: now,
        updatedBy: user?.email || null,
        lastLinkedInShareSchedule: document,
      },
      $push: {
        linkedinShareSchedules: {
          $each: [document],
          $position: 0,
          $slice: 20,
        },
      },
    },
    {returnDocument: "after"}
  );
  const post = result?.value || result;

  if (!post) {
    throw new PostValidationError("Post not found.", 404);
  }

  revalidatePublicPosts();

  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function recordPostLinkedInShareAttempt(postId, attempt = {}, user) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const _id = toObjectId(postId);
  const now = new Date();
  const document = {
    provider: "linkedin",
    attemptType: String(attempt.attemptType || "immediate"),
    target: String(attempt.target || "personal_profile"),
    language: attempt.language ? String(attempt.language) : null,
    commentary: String(attempt.commentary || ""),
    includeImage: attempt.includeImage === true,
    status: String(attempt.status || "failed"),
    scheduledJobId: attempt.scheduledJobId
      ? String(attempt.scheduledJobId)
      : "",
    attemptedAt:
      attempt.attemptedAt instanceof Date ? attempt.attemptedAt : now,
    failedAt: attempt.failedAt instanceof Date ? attempt.failedAt : null,
    failure: String(attempt.failure || ""),
    account: attempt.account
      ? {
          sub: String(attempt.account.sub || ""),
          email: String(attempt.account.email || ""),
          name: String(attempt.account.name || ""),
          picture: String(attempt.account.picture || ""),
        }
      : null,
    createdAt: now,
    createdBy: user?.email || null,
  };
  const result = await getPostsCollection(db).findOneAndUpdate(
    {_id},
    {
      $set: {
        updatedAt: now,
        updatedBy: user?.email || null,
        lastLinkedInShareAttempt: document,
      },
      $push: {
        linkedinShareAttempts: {
          $each: [document],
          $position: 0,
          $slice: 30,
        },
      },
    },
    {returnDocument: "after"}
  );
  const post = result?.value || result;

  if (!post) {
    throw new PostValidationError("Post not found.", 404);
  }

  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function updatePostLinkedInShareSchedule(
  postId,
  jobId,
  updates = {},
) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const _id = toObjectId(postId);
  const set = {};

  for (const [key, value] of Object.entries(updates)) {
    set[`linkedinShareSchedules.$.${key}`] = value;
  }

  if (Object.keys(set).length === 0) return;

  await getPostsCollection(db).updateOne(
    {_id, "linkedinShareSchedules.jobId": String(jobId || "")},
    {$set: set}
  );
}

async function readPublishedPosts(filters = {}) {
  const db = await getDb();

  const query = {status: "published"};
  const category = normalizeCategorySlug(filters.category || filters.tag);

  if (category) {
    query["categories.slug"] = category;
  }

  const posts = await getPostsCollection(db)
    .find(
      query,
      {
        projection: {
          contentHtml: 0,
          authorEmail: 0,
          updatedBy: 0,
        },
      }
    )
    .sort({publishedAt: -1, updatedAt: -1})
    .toArray();

  return posts.map((post) =>
    serializePost(post, {
      includeContent: false,
      language: filters.language,
    })
  );
}

export const getPublishedPosts = unstable_cache(
  readPublishedPosts,
  ["public-published-posts"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts],
  }
);

async function readPublishedPostCategories() {
  const db = await getDb();

  const categories = await getPostsCollection(db)
    .aggregate([
      {$match: {status: "published", "categories.0": {$exists: true}}},
      {$unwind: "$categories"},
      {
        $group: {
          _id: "$categories.slug",
          label: {$first: "$categories.label"},
          count: {$sum: 1},
        },
      },
      {$sort: {label: 1}},
    ])
    .toArray();

  return categories
    .map((category) => ({
      label: cleanText(category.label, 50),
      slug: normalizeCategorySlug(category._id),
      count: Number(category.count) || 0,
    }))
    .filter((category) => category.label && category.slug);
}

export const getPublishedPostCategories = unstable_cache(
  readPublishedPostCategories,
  ["public-published-post-categories"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts],
  }
);

async function readPublishedPostBySlug(slug, options = {}) {
  const db = await getDb();

  const post = await getPostsCollection(db).findOne({
    slug: String(slug || ""),
    status: "published",
  });

  return serializePost(post, {
    includeContent: true,
    language: options.language,
  });
}

export const getPublishedPostBySlug = unstable_cache(
  readPublishedPostBySlug,
  ["public-published-post-by-slug"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.posts],
  }
);
