import "server-only";

import {ObjectId} from "mongodb";
import sanitizeHtml from "sanitize-html";

import {getDb} from "./mongo";

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

function normalizePostInput(input = {}) {
  const title = cleanText(input.title, 140);

  if (title.length < 2) {
    throw new PostValidationError("Post title is required.");
  }

  const status = normalizeStatus(input.status);
  const contentHtml = sanitizePostHtml(input.contentHtml);
  const contentText = cleanText(contentHtml, 100000);

  if (status === "published" && contentText.length < 10) {
    throw new PostValidationError("Published posts need post content.");
  }

  return {
    title,
    slug: normalizePostSlugInput(input),
    status,
    summary: cleanText(input.summary || contentText, 260),
    categories: normalizeCategories(input.categories),
    contentHtml,
    media: normalizeMedia(input.media),
    publishedAt: normalizePublishedAt(input),
  };
}

export function serializePost(document, options = {}) {
  if (!document) return null;

  const includeContent = options.includeContent !== false;
  const post = {
    id: String(document._id),
    title: document.title || "",
    slug: document.slug || "",
    summary: document.summary || "",
    categories: normalizeCategories(document.categories),
    status: document.status || "draft",
    media: document.media || null,
    createdAt: toIsoDate(document.createdAt),
    updatedAt: toIsoDate(document.updatedAt),
    publishedAt: toIsoDate(document.publishedAt),
  };

  if (includeContent) {
    post.contentHtml = document.contentHtml || "";
  }

  if (options.includeAdmin) {
    post.authorEmail = document.authorEmail || null;
    post.updatedBy = document.updatedBy || null;
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

  return serializePost(post, {includeContent: true, includeAdmin: true});
}

export async function getPublishedPosts(filters = {}) {
  const db = await getDb();
  await ensurePostIndexes(db);

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

  return posts.map((post) => serializePost(post, {includeContent: false}));
}

export async function getPublishedPostCategories() {
  const db = await getDb();
  await ensurePostIndexes(db);

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

export async function getPublishedPostBySlug(slug) {
  const db = await getDb();
  await ensurePostIndexes(db);

  const post = await getPostsCollection(db).findOne({
    slug: String(slug || ""),
    status: "published",
  });

  return serializePost(post, {includeContent: true});
}
