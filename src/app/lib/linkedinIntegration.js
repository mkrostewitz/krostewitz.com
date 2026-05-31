import "server-only";

import crypto from "crypto";
import sanitizeHtml from "sanitize-html";

import {getDb} from "./mongo";
import {getAdminPostById, recordPostLinkedInShare} from "./posts";
import {getConfiguredSiteOrigin} from "./requestOrigin";

const CONTENT_COLLECTION = "site_content";
const LINKEDIN_INTEGRATION_ID = "linkedin_integration";
const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";
const DEFAULT_LINKEDIN_API_VERSION = "202605";
const DEFAULT_LINKEDIN_REQUEST_TIMEOUT_MS = 20000;
const TOKEN_FORMAT = "v1";

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
  const connection = {
    connected,
    needsReconnect: connected && isExpired(document.accessTokenExpiresAt),
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
      $unset: {disconnectedAt: ""},
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
      },
    },
    {upsert: true},
  );

  return getLinkedInConnection();
}

function buildPostUrl(post, origin) {
  if (!post?.slug) {
    throw new LinkedInIntegrationError("Only saved posts with a slug can be shared.");
  }

  return new URL(`/blog/${post.slug}`, origin).toString();
}

function buildLinkedInPostUrl(postUrn) {
  if (!postUrn) return "";
  return `https://www.linkedin.com/feed/update/${postUrn}/`;
}

function createCommentary(post, postUrl) {
  const title = cleanText(post.title, 140);
  const summary = cleanText(post.summary, 600);
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
  postId,
  origin,
  target = "personal_profile",
  user,
}) {
  if (target !== "personal_profile") {
    throw new LinkedInIntegrationError(
      "Company page publishing is not configured yet.",
      501,
    );
  }

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
  const postUrl = buildPostUrl(post, publicOrigin);
  const commentary = createCommentary(post, postUrl);
  const linkedInPostUrn = await createLinkedInPost({connection, commentary});
  const sharedAt = new Date();
  const share = {
    provider: "linkedin",
    postUrn: linkedInPostUrn,
    postUrl: buildLinkedInPostUrl(linkedInPostUrn),
    sharedPostUrl: postUrl,
    commentary,
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
