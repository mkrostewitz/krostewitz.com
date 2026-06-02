import "server-only";

import crypto from "crypto";
import sanitizeHtml from "sanitize-html";

import {FALLBACK_LANGUAGE} from "../../lib/languageDetection";
import {getSupportedSiteLanguage} from "../../lib/siteLanguages";
import {getDb} from "./mongo";
import {
  getAdminPostById,
  recordPostLinkedInShareAttempt,
  recordPostLinkedInShare,
  recordPostLinkedInShareSchedule,
  updatePostLinkedInShareSchedule,
} from "./posts";
import {getConfiguredSiteOrigin} from "./requestOrigin";

const CONTENT_COLLECTION = "site_content";
const LINKEDIN_SHARE_JOBS_COLLECTION = "linkedin_share_jobs";
const LINKEDIN_INTEGRATION_ID = "linkedin_integration";
const LINKEDIN_IMAGES_URL =
  "https://api.linkedin.com/rest/images?action=initializeUpload";
const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";
const DEFAULT_LINKEDIN_API_VERSION = "202605";
const DEFAULT_LINKEDIN_REQUEST_TIMEOUT_MS = 20000;
const LINKEDIN_IMAGE_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
]);
const TOKEN_FORMAT = "v1";

let shareJobsIndexPromise = null;

export class LinkedInIntegrationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "LinkedInIntegrationError";
    this.status = status;
  }
}

function getIntegrationCollection(db) {
  return db.collection(CONTENT_COLLECTION);
}

function getShareJobsCollection(db) {
  return db.collection(LINKEDIN_SHARE_JOBS_COLLECTION);
}

async function ensureShareJobsIndexes(db) {
  if (!shareJobsIndexPromise) {
    shareJobsIndexPromise = Promise.all([
      getShareJobsCollection(db).createIndex({status: 1, scheduledAt: 1}),
      getShareJobsCollection(db).createIndex({postId: 1, createdAt: -1}),
    ]).catch((error) => {
      shareJobsIndexPromise = null;
      throw error;
    });
  }

  await shareJobsIndexPromise;
}

function getLinkedInApiVersion() {
  return String(
    process.env.LINKEDIN_API_VERSION || DEFAULT_LINKEDIN_API_VERSION,
  )
    .trim()
    .replace(/[^0-9]/g, "")
    .slice(0, 6) || DEFAULT_LINKEDIN_API_VERSION;
}

function getLinkedInRequestTimeoutMs() {
  const timeout = Number(process.env.LINKEDIN_REQUEST_TIMEOUT_MS);

  if (!Number.isFinite(timeout) || timeout <= 0) {
    return DEFAULT_LINKEDIN_REQUEST_TIMEOUT_MS;
  }

  return Math.min(60000, Math.max(5000, timeout));
}

function normalizeBooleanFlag(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

export function isLinkedInSchedulerEnabled() {
  return normalizeBooleanFlag(process.env.LINKEDIN_SCHEDULER_ENABLED);
}

export function isLinkedInSchedulerConfigured() {
  return Boolean(
    isLinkedInSchedulerEnabled() &&
      String(process.env.LINKEDIN_SCHEDULER_SECRET || "").trim(),
  );
}

function getEncryptionSecret() {
  return (
    process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY ||
    process.env.AUTH_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET
  );
}

function getEncryptionKey() {
  const secret = getEncryptionSecret();

  if (!secret || secret.length < 32) {
    throw new LinkedInIntegrationError(
      "LinkedIn token encryption needs AUTH_SECRET or LINKEDIN_TOKEN_ENCRYPTION_KEY with at least 32 characters.",
      500,
    );
  }

  return crypto.createHash("sha256").update(secret).digest();
}

function encryptToken(token) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(token), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_FORMAT,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

function decryptToken(value) {
  const [format, iv, tag, ciphertext] = String(value || "").split(".");

  if (
    format !== TOKEN_FORMAT ||
    !iv ||
    !tag ||
    !ciphertext
  ) {
    throw new LinkedInIntegrationError(
      "Stored LinkedIn token is invalid. Reconnect LinkedIn.",
      401,
    );
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function toIsoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function cleanText(value, maxLength = 3000) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultilineText(value, maxLength = 3000) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeShareTarget(value) {
  const target = String(value || "personal_profile").trim();

  if (target !== "personal_profile") {
    throw new LinkedInIntegrationError(
      "Company page publishing is not configured yet.",
      501,
    );
  }

  return target;
}

function normalizeShareLanguage(value) {
  return getSupportedSiteLanguage(value) || FALLBACK_LANGUAGE;
}

function normalizeTimeZone(value) {
  const timeZone = String(value || "").trim();

  if (!timeZone) return "";

  try {
    new Intl.DateTimeFormat("en", {timeZone}).format(new Date());
    return timeZone;
  } catch {
    return "";
  }
}

function getBestTextValue(post, language, key, maxLength) {
  const supportedLanguage = normalizeShareLanguage(language);
  const translations = post?.translations || {};
  const candidates = [
    translations[supportedLanguage]?.[key],
    translations[FALLBACK_LANGUAGE]?.[key],
    ...Object.values(translations).map((translation) => translation?.[key]),
    post?.[key],
  ];

  for (const candidate of candidates) {
    const text = cleanText(candidate, maxLength);

    if (text) return text;
  }

  return "";
}

function getBestSummary(post, language) {
  const summary = getBestTextValue(post, language, "summary", 600);

  if (summary) return summary;

  const supportedLanguage = normalizeShareLanguage(language);
  const translations = post?.translations || {};
  const candidates = [
    translations[supportedLanguage]?.contentHtml,
    translations[FALLBACK_LANGUAGE]?.contentHtml,
    ...Object.values(translations).map((translation) => translation?.contentHtml),
    post?.contentHtml,
  ];

  for (const candidate of candidates) {
    const text = cleanText(candidate, 600);

    if (text) return text;
  }

  return "";
}

function getLinkedInHeaders(connection, headers = {}) {
  return {
    Authorization: `Bearer ${connection.accessToken}`,
    "LinkedIn-Version": getLinkedInApiVersion(),
    "X-Restli-Protocol-Version": "2.0.0",
    ...headers,
  };
}

function getImageContentTypeFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (pathname.endsWith(".png")) return "image/png";
  } catch {
    return "";
  }

  return "";
}

function normalizeImageContentType(value) {
  const contentType = String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  if (contentType === "image/jpg") return "image/jpeg";

  return contentType;
}

function getSupportedImageContentType(media, responseContentType = "") {
  const contentType =
    normalizeImageContentType(media?.mimeType) ||
    normalizeImageContentType(responseContentType) ||
    getImageContentTypeFromUrl(media?.url);

  return LINKEDIN_IMAGE_CONTENT_TYPES.has(contentType) ? contentType : "";
}

function hasShareableLinkedInImage(post) {
  const media = post?.media;

  if (media?.type !== "image" || !media.url) return false;

  return Boolean(
    getSupportedImageContentType(media) || !normalizeImageContentType(media.mimeType)
  );
}

function isOnlyPostUrl(value, postUrl) {
  const normalizedValue = String(value || "").trim().replace(/\/+$/, "");
  const normalizedPostUrl = String(postUrl || "").trim().replace(/\/+$/, "");

  return Boolean(normalizedPostUrl && normalizedValue === normalizedPostUrl);
}

function normalizeProfile(profile = {}) {
  const sub = cleanText(profile.sub, 120);
  const email = cleanText(profile.email, 180).toLowerCase();

  if (!sub || !email) {
    throw new LinkedInIntegrationError(
      "LinkedIn did not return enough account information.",
      400,
    );
  }

  return {
    sub,
    email,
    name: cleanText(profile.name || email, 180),
    picture: String(profile.picture || "").trim(),
  };
}

function getTokenExpiry(tokens = {}) {
  const expiresIn = Number(tokens.expires_in);

  if (!Number.isFinite(expiresIn) || expiresIn <= 0) return null;

  return new Date(Date.now() + expiresIn * 1000);
}

function isExpired(value) {
  if (!value) return false;
  return new Date(value).getTime() <= Date.now();
}

function serializeConnection(document, options = {}) {
  const connected = Boolean(
    document?.connected &&
      document?.profile?.sub &&
      document?.encryptedAccessToken,
  );
  const expiresAt = toIsoDate(document?.accessTokenExpiresAt);
  const tokenInvalidatedAt = toIsoDate(document?.tokenInvalidatedAt);
  const connection = {
    connected,
    needsReconnect:
      connected &&
      (isExpired(document.accessTokenExpiresAt) || Boolean(tokenInvalidatedAt)),
    profile: connected
      ? {
          sub: document.profile.sub,
          email: document.profile.email,
          name: document.profile.name,
          picture: document.profile.picture || "",
        }
      : null,
    authorUrn: connected ? document.authorUrn || "" : "",
    scopes: Array.isArray(document?.scopes) ? document.scopes : [],
    accessTokenExpiresAt: expiresAt,
    tokenInvalidatedAt,
    tokenInvalidationReason: document?.tokenInvalidationReason || "",
    lastPublishedAt: toIsoDate(document?.lastPublishedAt),
    updatedAt: toIsoDate(document?.updatedAt),
    updatedBy: document?.updatedBy || null,
    apiVersion: getLinkedInApiVersion(),
  };

  if (options.includeAccessToken && connected) {
    connection.accessToken = decryptToken(document.encryptedAccessToken);
  }

  return connection;
}

export async function getLinkedInConnection(options = {}) {
  const db = await getDb();
  const document = await getIntegrationCollection(db).findOne({
    _id: LINKEDIN_INTEGRATION_ID,
  });

  return serializeConnection(document, options);
}

export async function saveLinkedInConnection({
  profile,
  scopes = [],
  tokens,
  user,
}) {
  if (!tokens?.access_token) {
    throw new LinkedInIntegrationError("LinkedIn did not return an access token.");
  }

  const normalizedProfile = normalizeProfile(profile);
  const now = new Date();
  const document = {
    provider: "linkedin",
    connected: true,
    profile: normalizedProfile,
    authorUrn: `urn:li:person:${normalizedProfile.sub}`,
    scopes: [...new Set(scopes.map((scope) => String(scope).trim()).filter(Boolean))],
    encryptedAccessToken: encryptToken(tokens.access_token),
    accessTokenExpiresAt: getTokenExpiry(tokens),
    updatedAt: now,
    updatedBy: user?.email || null,
  };
  const db = await getDb();

  await getIntegrationCollection(db).updateOne(
    {_id: LINKEDIN_INTEGRATION_ID},
    {
      $set: document,
      $setOnInsert: {createdAt: now},
      $unset: {
        disconnectedAt: "",
        tokenInvalidatedAt: "",
        tokenInvalidationReason: "",
      },
    },
    {upsert: true},
  );

  return serializeConnection(document);
}

export async function disconnectLinkedInConnection(user) {
  const now = new Date();
  const db = await getDb();

  await getIntegrationCollection(db).updateOne(
    {_id: LINKEDIN_INTEGRATION_ID},
    {
      $set: {
        provider: "linkedin",
        connected: false,
        disconnectedAt: now,
        updatedAt: now,
        updatedBy: user?.email || null,
      },
      $unset: {
        accessTokenExpiresAt: "",
        authorUrn: "",
        encryptedAccessToken: "",
        lastPublishedAt: "",
        profile: "",
        scopes: "",
        tokenInvalidatedAt: "",
        tokenInvalidationReason: "",
      },
    },
    {upsert: true},
  );

  return getLinkedInConnection();
}

async function markLinkedInConnectionNeedsReconnect(reason, user) {
  const now = new Date();
  const db = await getDb();

  await getIntegrationCollection(db).updateOne(
    {_id: LINKEDIN_INTEGRATION_ID},
    {
      $set: {
        tokenInvalidatedAt: now,
        tokenInvalidationReason: cleanText(reason, 300),
        accessTokenExpiresAt: new Date(0),
        updatedAt: now,
        updatedBy: user?.email || null,
      },
    },
  );
}

async function fetchWithTimeout(url, options = {}, errorMessage) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getLinkedInRequestTimeoutMs(),
  );

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new LinkedInIntegrationError(
        errorMessage || "LinkedIn did not respond in time.",
        504,
      );
    }

    throw new LinkedInIntegrationError(
      errorMessage || "Unable to reach LinkedIn. Try again in a moment.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}

function buildPostUrl(post, origin, language) {
  if (!post?.slug) {
    throw new LinkedInIntegrationError("Only saved posts with a slug can be shared.");
  }

  const url = new URL(`/blog/${post.slug}`, origin);
  const supportedLanguage = normalizeShareLanguage(language);

  if (supportedLanguage !== FALLBACK_LANGUAGE) {
    url.searchParams.set("lng", supportedLanguage);
  }

  return url.toString();
}

function buildLinkedInPostUrl(postUrn) {
  if (!postUrn) return "";
  return `https://www.linkedin.com/feed/update/${postUrn}/`;
}

function createCommentary(post, postUrl, options = {}) {
  const customCommentary = cleanMultilineText(options.commentary, 2800);
  const title = getBestTextValue(post, options.language, "title", 140);
  const summary = getBestSummary(post, options.language);
  const customLines =
    customCommentary && !isOnlyPostUrl(customCommentary, postUrl)
      ? [customCommentary]
      : [];
  const fallbackLines = customLines.length > 0 ? [] : [title, summary];
  const lines = [...customLines, ...fallbackLines, postUrl].filter(Boolean);

  return lines.join("\n\n").slice(0, 2900);
}

function getImageAltText(post, language) {
  return (
    getBestTextValue(post, language, "title", 300) ||
    getBestSummary(post, language).slice(0, 300) ||
    "Blog post image"
  );
}

function getLinkedInErrorMessage(data, fallback) {
  return (
    data?.message ||
    data?.error_description ||
    data?.error ||
    fallback ||
    "LinkedIn request failed."
  );
}

function attachPostToError(error, post) {
  if (error && typeof error === "object" && post) {
    error.post = post;
  }

  return error;
}

async function initializeLinkedInImageUpload(connection) {
  const response = await fetchWithTimeout(
    LINKEDIN_IMAGES_URL,
    {
      method: "POST",
      headers: getLinkedInHeaders(connection, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({
        initializeUploadRequest: {
          owner: connection.authorUrn,
        },
      }),
      cache: "no-store",
    },
    "Unable to initialize LinkedIn image upload.",
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new LinkedInIntegrationError(
      getLinkedInErrorMessage(data, "Unable to initialize LinkedIn image upload."),
      response.status === 401 ? 401 : 502,
    );
  }

  const uploadUrl = data?.value?.uploadUrl;
  const imageUrn = data?.value?.image;

  if (!uploadUrl || !imageUrn) {
    throw new LinkedInIntegrationError(
      "LinkedIn did not return an image upload URL.",
      502,
    );
  }

  return {imageUrn, uploadUrl};
}

async function downloadPostImage(media) {
  const response = await fetchWithTimeout(
    media.url,
    {cache: "no-store"},
    "Unable to download the post image before sharing to LinkedIn.",
  );

  if (!response.ok) {
    throw new LinkedInIntegrationError(
      "Unable to download the post image before sharing to LinkedIn.",
      502,
    );
  }

  const contentType = getSupportedImageContentType(
    media,
    response.headers.get("content-type"),
  );

  if (!contentType) {
    throw new LinkedInIntegrationError(
      "LinkedIn image sharing supports JPG, PNG, and GIF images. Convert this post image before sharing it.",
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
  };
}

async function uploadLinkedInImageBinary({
  buffer,
  connection,
  contentType,
  uploadUrl,
}) {
  const response = await fetchWithTimeout(
    uploadUrl,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": contentType,
      },
      body: buffer,
      cache: "no-store",
    },
    "Unable to upload the post image to LinkedIn.",
  );

  if (!response.ok) {
    throw new LinkedInIntegrationError(
      "Unable to upload the post image to LinkedIn.",
      response.status === 401 ? 401 : 502,
    );
  }
}

async function uploadPostImageToLinkedIn({connection, language, post}) {
  if (!hasShareableLinkedInImage(post)) return null;

  const media = post.media;
  const {buffer, contentType} = await downloadPostImage(media);
  const {imageUrn, uploadUrl} = await initializeLinkedInImageUpload(connection);

  await uploadLinkedInImageBinary({
    buffer,
    connection,
    contentType,
    uploadUrl,
  });

  return {
    altText: getImageAltText(post, language),
    imageUrn,
    mimeType: contentType,
    sourceUrl: media.url,
  };
}

async function createLinkedInPost({connection, commentary, image}) {
  const payload = {
    author: connection.authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (image?.imageUrn) {
    payload.content = {
      media: {
        altText: image.altText,
        id: image.imageUrn,
      },
    };
  }

  const response = await fetchWithTimeout(
    LINKEDIN_POSTS_URL,
    {
      method: "POST",
      headers: getLinkedInHeaders(connection, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify(payload),
      cache: "no-store",
    },
    "Unable to reach LinkedIn. Try again in a moment.",
  );
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new LinkedInIntegrationError(
      getLinkedInErrorMessage(data, "Unable to publish to LinkedIn."),
      response.status === 401 ? 401 : 502,
    );
  }

  return response.headers.get("x-restli-id") || data.id || "";
}

export async function publishPostToLinkedIn({
  commentary,
  includeImage = true,
  language,
  postId,
  origin,
  scheduledJobId = "",
  target = "personal_profile",
  user,
}) {
  const normalizedTarget = normalizeShareTarget(target);
  const normalizedLanguage = normalizeShareLanguage(language);

  const post = await getAdminPostById(postId);

  if (!post) {
    throw new LinkedInIntegrationError("Post not found.", 404);
  }

  if (post.status !== "published") {
    throw new LinkedInIntegrationError("Only published posts can be shared.");
  }

  const publicOrigin = getConfiguredSiteOrigin() || origin;
  const postUrl = buildPostUrl(post, publicOrigin, normalizedLanguage);
  const finalCommentary = createCommentary(post, postUrl, {
    commentary,
    language: normalizedLanguage,
  });
  const attemptedAt = new Date();
  let connection = null;
  let linkedInImage = null;
  let linkedInPostUrn;

  try {
    connection = await getLinkedInConnection({includeAccessToken: true});

    if (!connection.connected || !connection.accessToken) {
      throw new LinkedInIntegrationError("Connect LinkedIn before sharing posts.", 409);
    }

    if (connection.needsReconnect) {
      throw new LinkedInIntegrationError("Reconnect LinkedIn before sharing posts.", 401);
    }

    linkedInImage = includeImage
      ? await uploadPostImageToLinkedIn({
          connection,
          language: normalizedLanguage,
          post,
        })
      : null;
    linkedInPostUrn = await createLinkedInPost({
      connection,
      commentary: finalCommentary,
      image: linkedInImage,
    });
  } catch (error) {
    let updatedPost = null;

    if (!scheduledJobId) {
      try {
        updatedPost = await recordPostLinkedInShareAttempt(
          post.id,
          {
            attemptType: "immediate",
            target: normalizedTarget,
            language: normalizedLanguage,
            commentary: finalCommentary,
            includeImage: includeImage && hasShareableLinkedInImage(post),
            status: "failed",
            attemptedAt,
            failedAt: new Date(),
            failure: error?.message || "Unable to share post to LinkedIn.",
            account: connection?.profile || null,
          },
          user,
        );
      } catch (historyError) {
        console.warn("Unable to record LinkedIn share attempt", historyError);
      }
    }

    if (error instanceof LinkedInIntegrationError && error.status === 401) {
      await markLinkedInConnectionNeedsReconnect(error.message, user);
      throw attachPostToError(
        new LinkedInIntegrationError(
          "LinkedIn publishing access was revoked. Reconnect LinkedIn before sharing posts.",
          401,
        ),
        updatedPost,
      );
    }

    throw attachPostToError(error, updatedPost);
  }

  const sharedAt = new Date();
  const share = {
    provider: "linkedin",
    target: normalizedTarget,
    language: normalizedLanguage,
    scheduledJobId,
    postUrn: linkedInPostUrn,
    postUrl: buildLinkedInPostUrl(linkedInPostUrn),
    sharedPostUrl: postUrl,
    commentary: finalCommentary,
    media: linkedInImage
      ? {
          imageUrn: linkedInImage.imageUrn,
          mimeType: linkedInImage.mimeType,
          sourceUrl: linkedInImage.sourceUrl,
        }
      : null,
    account: connection.profile,
    sharedAt,
  };
  const updatedPost = await recordPostLinkedInShare(post.id, share, user);
  const db = await getDb();

  await getIntegrationCollection(db).updateOne(
    {_id: LINKEDIN_INTEGRATION_ID},
    {
      $set: {
        lastPublishedAt: sharedAt,
        updatedAt: sharedAt,
        updatedBy: user?.email || null,
      },
    },
  );

  return {
    post: updatedPost,
    linkedin: {
      ...share,
      sharedAt: sharedAt.toISOString(),
    },
  };
}

function normalizeScheduledAt(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new LinkedInIntegrationError("Scheduled time is invalid.");
  }

  if (date.getTime() <= Date.now() + 30000) {
    throw new LinkedInIntegrationError(
      "Scheduled time must be at least 30 seconds in the future.",
    );
  }

  return date;
}

function normalizeScheduledJobId(value) {
  const jobId = String(value || "").trim();

  if (!jobId) {
    throw new LinkedInIntegrationError("Scheduled LinkedIn share not found.", 404);
  }

  return jobId;
}

export async function schedulePostToLinkedIn({
  commentary,
  includeImage = true,
  language,
  postId,
  origin,
  scheduledAt,
  scheduledTimeZone,
  target = "personal_profile",
  user,
}) {
  const normalizedTarget = normalizeShareTarget(target);
  const normalizedLanguage = normalizeShareLanguage(language);
  const normalizedTimeZone = normalizeTimeZone(scheduledTimeZone);
  const scheduleDate = normalizeScheduledAt(scheduledAt);

  if (!isLinkedInSchedulerConfigured()) {
    throw new LinkedInIntegrationError(
      "LinkedIn scheduler is disabled. Enable LINKEDIN_SCHEDULER_ENABLED and LINKEDIN_SCHEDULER_SECRET before scheduling posts.",
      409,
    );
  }

  const post = await getAdminPostById(postId);

  if (!post) {
    throw new LinkedInIntegrationError("Post not found.", 404);
  }

  if (post.status !== "published") {
    throw new LinkedInIntegrationError("Only published posts can be scheduled.");
  }

  const connection = await getLinkedInConnection();

  if (!connection.connected) {
    throw new LinkedInIntegrationError("Connect LinkedIn before scheduling posts.", 409);
  }

  if (connection.needsReconnect) {
    throw new LinkedInIntegrationError("Reconnect LinkedIn before scheduling posts.", 401);
  }

  const publicOrigin = getConfiguredSiteOrigin() || origin;
  const postUrl = buildPostUrl(post, publicOrigin, normalizedLanguage);
  const customCommentary = cleanMultilineText(commentary, 2800);
  const finalCommentary = createCommentary(post, postUrl, {
    commentary: customCommentary,
    language: normalizedLanguage,
  });
  const now = new Date();
  const job = {
    _id: crypto.randomUUID(),
    provider: "linkedin",
    status: "scheduled",
    postId: post.id,
    target: normalizedTarget,
    language: normalizedLanguage,
    commentary: finalCommentary,
    customCommentary,
    includeImage: includeImage && hasShareableLinkedInImage(post),
    origin: publicOrigin,
    account: connection.profile,
    scheduledAt: scheduleDate,
    scheduledTimeZone: normalizedTimeZone,
    createdAt: now,
    createdBy: user?.email || null,
    updatedAt: now,
  };
  const db = await getDb();

  await ensureShareJobsIndexes(db);
  await getShareJobsCollection(db).insertOne(job);

  const updatedPost = await recordPostLinkedInShareSchedule(
    post.id,
    {
      jobId: job._id,
      target: normalizedTarget,
      language: normalizedLanguage,
      commentary: customCommentary,
      includeImage: includeImage && hasShareableLinkedInImage(post),
      account: connection.profile,
      scheduledAt: scheduleDate,
      scheduledTimeZone: normalizedTimeZone,
    },
    user,
  );

  return {
    scheduled: true,
    post: updatedPost,
    linkedin: {
      jobId: job._id,
      target: normalizedTarget,
      language: normalizedLanguage,
      scheduledAt: scheduleDate.toISOString(),
      scheduledTimeZone: normalizedTimeZone,
      commentary: finalCommentary,
      customCommentary,
      includeImage: includeImage && hasShareableLinkedInImage(post),
    },
  };
}

export async function updateScheduledPostToLinkedIn({
  commentary,
  includeImage = true,
  jobId,
  language,
  postId,
  origin,
  scheduledAt,
  scheduledTimeZone,
  target = "personal_profile",
  user,
}) {
  const normalizedJobId = normalizeScheduledJobId(jobId);
  const normalizedTarget = normalizeShareTarget(target);
  const normalizedLanguage = normalizeShareLanguage(language);
  const normalizedTimeZone = normalizeTimeZone(scheduledTimeZone);
  const scheduleDate = normalizeScheduledAt(scheduledAt);

  if (!isLinkedInSchedulerConfigured()) {
    throw new LinkedInIntegrationError(
      "LinkedIn scheduler is disabled. Enable LINKEDIN_SCHEDULER_ENABLED and LINKEDIN_SCHEDULER_SECRET before scheduling posts.",
      409,
    );
  }

  const post = await getAdminPostById(postId);

  if (!post) {
    throw new LinkedInIntegrationError("Post not found.", 404);
  }

  if (post.status !== "published") {
    throw new LinkedInIntegrationError("Only published posts can be scheduled.");
  }

  const db = await getDb();
  await ensureShareJobsIndexes(db);

  const existingJob = await getShareJobsCollection(db).findOne({
    _id: normalizedJobId,
    postId: post.id,
  });

  if (!existingJob) {
    throw new LinkedInIntegrationError("Scheduled LinkedIn share not found.", 404);
  }

  if (existingJob.status !== "scheduled") {
    throw new LinkedInIntegrationError(
      "Only pending scheduled LinkedIn shares can be edited.",
      409,
    );
  }

  const connection = await getLinkedInConnection();

  if (!connection.connected) {
    throw new LinkedInIntegrationError("Connect LinkedIn before scheduling posts.", 409);
  }

  if (connection.needsReconnect) {
    throw new LinkedInIntegrationError("Reconnect LinkedIn before scheduling posts.", 401);
  }

  const publicOrigin = getConfiguredSiteOrigin() || origin;
  const postUrl = buildPostUrl(post, publicOrigin, normalizedLanguage);
  const customCommentary = cleanMultilineText(commentary, 2800);
  const finalCommentary = createCommentary(post, postUrl, {
    commentary: customCommentary,
    language: normalizedLanguage,
  });
  const now = new Date();
  const normalizedIncludeImage = includeImage && hasShareableLinkedInImage(post);
  const jobPatch = {
    target: normalizedTarget,
    language: normalizedLanguage,
    commentary: finalCommentary,
    customCommentary,
    includeImage: normalizedIncludeImage,
    origin: publicOrigin,
    account: connection.profile,
    scheduledAt: scheduleDate,
    scheduledTimeZone: normalizedTimeZone,
    updatedAt: now,
    updatedBy: user?.email || null,
  };
  const updatedJob = await getShareJobsCollection(db).findOneAndUpdate(
    {_id: normalizedJobId, postId: post.id, status: "scheduled"},
    {$set: jobPatch},
    {returnDocument: "after"},
  );
  const nextJob = updatedJob?.value || updatedJob;

  if (!nextJob) {
    throw new LinkedInIntegrationError(
      "This scheduled LinkedIn share is already being processed.",
      409,
    );
  }

  await updatePostLinkedInShareSchedule(post.id, normalizedJobId, {
    target: normalizedTarget,
    language: normalizedLanguage,
    commentary: customCommentary,
    includeImage: normalizedIncludeImage,
    account: connection.profile,
    scheduledAt: scheduleDate,
    scheduledTimeZone: normalizedTimeZone,
    updatedAt: now,
    updatedBy: user?.email || null,
    failure: "",
  });

  const updatedPost = await getAdminPostById(post.id);

  return {
    scheduled: true,
    updated: true,
    post: updatedPost,
    linkedin: {
      jobId: normalizedJobId,
      target: normalizedTarget,
      language: normalizedLanguage,
      scheduledAt: scheduleDate.toISOString(),
      scheduledTimeZone: normalizedTimeZone,
      commentary: finalCommentary,
      customCommentary,
      includeImage: normalizedIncludeImage,
    },
  };
}

export async function cancelScheduledPostToLinkedIn({jobId, postId, user}) {
  const normalizedJobId = normalizeScheduledJobId(jobId);
  const post = await getAdminPostById(postId);

  if (!post) {
    throw new LinkedInIntegrationError("Post not found.", 404);
  }

  const db = await getDb();
  await ensureShareJobsIndexes(db);

  const existingJob = await getShareJobsCollection(db).findOne({
    _id: normalizedJobId,
    postId: post.id,
  });

  if (!existingJob) {
    throw new LinkedInIntegrationError("Scheduled LinkedIn share not found.", 404);
  }

  if (existingJob.status !== "scheduled") {
    throw new LinkedInIntegrationError(
      "Only pending scheduled LinkedIn shares can be canceled.",
      409,
    );
  }

  const now = new Date();
  const result = await getShareJobsCollection(db).findOneAndUpdate(
    {_id: normalizedJobId, postId: post.id, status: "scheduled"},
    {
      $set: {
        canceledAt: now,
        canceledBy: user?.email || null,
        status: "canceled",
        updatedAt: now,
      },
    },
    {returnDocument: "after"},
  );
  const canceledJob = result?.value || result;

  if (!canceledJob) {
    throw new LinkedInIntegrationError(
      "This scheduled LinkedIn share is already being processed.",
      409,
    );
  }

  await updatePostLinkedInShareSchedule(post.id, normalizedJobId, {
    canceledAt: now,
    canceledBy: user?.email || null,
    failure: "",
    status: "canceled",
    updatedAt: now,
    updatedBy: user?.email || null,
  });

  const updatedPost = await getAdminPostById(post.id);

  return {
    canceled: true,
    post: updatedPost,
    linkedin: {
      canceledAt: now.toISOString(),
      jobId: normalizedJobId,
      status: "canceled",
    },
  };
}

async function claimLinkedInShareJob(job) {
  const db = await getDb();
  const now = new Date();
  const result = await getShareJobsCollection(db).findOneAndUpdate(
    {_id: job._id, status: "scheduled"},
    {
      $set: {
        status: "processing",
        processingStartedAt: now,
        updatedAt: now,
      },
    },
    {returnDocument: "after"},
  );

  return result?.value || result;
}

export async function publishDueLinkedInShares({limit = 5} = {}) {
  const db = await getDb();

  await ensureShareJobsIndexes(db);

  const jobs = await getShareJobsCollection(db)
    .find({
      status: "scheduled",
      scheduledAt: {$lte: new Date()},
    })
    .sort({scheduledAt: 1})
    .limit(Math.min(20, Math.max(1, Number(limit) || 5)))
    .toArray();
  const results = [];

  for (const job of jobs) {
    const claimedJob = await claimLinkedInShareJob(job);
    if (!claimedJob) continue;

    try {
      await updatePostLinkedInShareSchedule(claimedJob.postId, claimedJob._id, {
        status: "processing",
        processingStartedAt: claimedJob.processingStartedAt || new Date(),
        failure: "",
        updatedAt: claimedJob.processingStartedAt || new Date(),
      });

      const result = await publishPostToLinkedIn({
        commentary: claimedJob.commentary,
        includeImage: claimedJob.includeImage === true,
        language: claimedJob.language,
        postId: claimedJob.postId,
        origin: claimedJob.origin || getConfiguredSiteOrigin(),
        scheduledJobId: claimedJob._id,
        target: claimedJob.target,
        user: {email: claimedJob.createdBy},
      });
      const now = new Date();

      await getShareJobsCollection(db).updateOne(
        {_id: claimedJob._id},
        {
          $set: {
            status: "published",
            publishedAt: now,
            linkedInPostUrn: result.linkedin.postUrn,
            linkedInPostUrl: result.linkedin.postUrl,
            media: result.linkedin.media || null,
            updatedAt: now,
          },
        },
      );
      await updatePostLinkedInShareSchedule(claimedJob.postId, claimedJob._id, {
        status: "published",
        processingStartedAt: claimedJob.processingStartedAt || now,
        publishedAt: now,
        linkedInPostUrn: result.linkedin.postUrn,
        linkedInPostUrl: result.linkedin.postUrl,
        failure: "",
        updatedAt: now,
      });
      results.push({jobId: claimedJob._id, status: "published"});
    } catch (error) {
      const now = new Date();
      const failure = error?.message || "Unable to publish scheduled share.";

      await getShareJobsCollection(db).updateOne(
        {_id: claimedJob._id},
        {
          $set: {
            status: "failed",
            failedAt: now,
            failure,
            updatedAt: now,
          },
        },
      );
      await updatePostLinkedInShareSchedule(claimedJob.postId, claimedJob._id, {
        status: "failed",
        processingStartedAt: claimedJob.processingStartedAt || now,
        failedAt: now,
        failure,
        updatedAt: now,
      });
      results.push({jobId: claimedJob._id, status: "failed", error: failure});
    }
  }

  return {
    checked: jobs.length,
    results,
  };
}
