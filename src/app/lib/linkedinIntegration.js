import "server-only";

import crypto from "crypto";
import sanitizeHtml from "sanitize-html";

import {FALLBACK_LANGUAGE} from "../../lib/languageDetection";
import {getSupportedSiteLanguage} from "../../lib/siteLanguages";
import {getDb} from "./mongo";
import {
  getAdminPostById,
  recordPostLinkedInShare,
  recordPostLinkedInShareSchedule,
  updatePostLinkedInShareSchedule,
} from "./posts";
import {getConfiguredSiteOrigin} from "./requestOrigin";

const CONTENT_COLLECTION = "site_content";
const LINKEDIN_SHARE_JOBS_COLLECTION = "linkedin_share_jobs";
const LINKEDIN_INTEGRATION_ID = "linkedin_integration";
const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";
const DEFAULT_LINKEDIN_API_VERSION = "202605";
const DEFAULT_LINKEDIN_REQUEST_TIMEOUT_MS = 20000;
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

function getLocalizedPostTranslation(post, language) {
  const supportedLanguage = normalizeShareLanguage(language);
  const translation = post?.translations?.[supportedLanguage];

  if (translation?.title || translation?.summary || translation?.contentHtml) {
    return {
      language: supportedLanguage,
      title: translation.title || post.title || "",
      summary: translation.summary || post.summary || "",
      contentHtml: translation.contentHtml || post.contentHtml || "",
    };
  }

  const fallback = post?.translations?.[FALLBACK_LANGUAGE];

  return {
    language: FALLBACK_LANGUAGE,
    title: fallback?.title || post.title || "",
    summary: fallback?.summary || post.summary || "",
    contentHtml: fallback?.contentHtml || post.contentHtml || "",
  };
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
  const customCommentary = cleanText(options.commentary, 2800);

  if (customCommentary) {
    return customCommentary.includes(postUrl)
      ? customCommentary
      : `${customCommentary}\n\n${postUrl}`;
  }

  const translation = getLocalizedPostTranslation(post, options.language);
  const title = cleanText(translation.title, 140);
  const summary = cleanText(translation.summary, 600);
  const lines = [title, summary, postUrl].filter(Boolean);

  return lines.join("\n\n").slice(0, 2900);
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

async function createLinkedInPost({connection, commentary}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    getLinkedInRequestTimeoutMs(),
  );
  let response;

  try {
    response = await fetch(LINKEDIN_POSTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${connection.accessToken}`,
        "Content-Type": "application/json",
        "LinkedIn-Version": getLinkedInApiVersion(),
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify({
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
      }),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new LinkedInIntegrationError(
        "LinkedIn did not respond in time. Check LinkedIn app permissions and try again.",
        504,
      );
    }

    throw new LinkedInIntegrationError(
      "Unable to reach LinkedIn. Try again in a moment.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }

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

  const connection = await getLinkedInConnection({includeAccessToken: true});

  if (!connection.connected || !connection.accessToken) {
    throw new LinkedInIntegrationError("Connect LinkedIn before sharing posts.", 409);
  }

  if (connection.needsReconnect) {
    throw new LinkedInIntegrationError("Reconnect LinkedIn before sharing posts.", 401);
  }

  const publicOrigin = getConfiguredSiteOrigin() || origin;
  const postUrl = buildPostUrl(post, publicOrigin, normalizedLanguage);
  const finalCommentary = createCommentary(post, postUrl, {
    commentary,
    language: normalizedLanguage,
  });
  let linkedInPostUrn;

  try {
    linkedInPostUrn = await createLinkedInPost({
      connection,
      commentary: finalCommentary,
    });
  } catch (error) {
    if (error instanceof LinkedInIntegrationError && error.status === 401) {
      await markLinkedInConnectionNeedsReconnect(error.message, user);
      throw new LinkedInIntegrationError(
        "LinkedIn publishing access was revoked. Reconnect LinkedIn before sharing posts.",
        401,
      );
    }

    throw error;
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

export async function schedulePostToLinkedIn({
  commentary,
  language,
  postId,
  origin,
  scheduledAt,
  target = "personal_profile",
  user,
}) {
  const normalizedTarget = normalizeShareTarget(target);
  const normalizedLanguage = normalizeShareLanguage(language);
  const scheduleDate = normalizeScheduledAt(scheduledAt);
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
  const finalCommentary = createCommentary(post, postUrl, {
    commentary,
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
    origin: publicOrigin,
    account: connection.profile,
    scheduledAt: scheduleDate,
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
      account: connection.profile,
      scheduledAt: scheduleDate,
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
      commentary: finalCommentary,
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
      const result = await publishPostToLinkedIn({
        commentary: claimedJob.commentary,
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
            updatedAt: now,
          },
        },
      );
      await updatePostLinkedInShareSchedule(claimedJob.postId, claimedJob._id, {
        status: "published",
        publishedAt: now,
        failure: "",
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
        failedAt: now,
        failure,
      });
      results.push({jobId: claimedJob._id, status: "failed", error: failure});
    }
  }

  return {
    checked: jobs.length,
    results,
  };
}
