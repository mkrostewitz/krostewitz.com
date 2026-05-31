import "server-only";

import crypto from "crypto";

import {
  getConfiguredSiteOrigin,
  getRequestOrigin,
  isLocalOrigin,
} from "./requestOrigin";

const AUTHORIZATION_URL = "https://www.linkedin.com/oauth/v2/authorization";
const ACCESS_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const CALLBACK_PATH = "/api/admin/auth/linkedin/callback";
const STATE_COOKIE = "mk_admin_linkedin_state";
const STATE_MAX_AGE_SECONDS = 60 * 10;
const REQUIRED_SCOPES = ["openid", "profile", "email"];
export const LINKEDIN_PUBLISHING_SCOPES = ["w_member_social"];

function isEnabledFlag(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "")
      .trim()
      .toLowerCase(),
  );
}

function getAuthSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET
  );
}

function requireAuthSecret() {
  const secret = getAuthSecret();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

function getLinkedInCredentials() {
  const clientId = String(process.env.LINKEDIN_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.LINKEDIN_CLIENT_SECRET || "").trim();

  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn OAuth credentials are not configured.");
  }

  return {clientId, clientSecret};
}

function hasLinkedInCredentials() {
  return Boolean(
    String(process.env.LINKEDIN_CLIENT_ID || "").trim() &&
      String(process.env.LINKEDIN_CLIENT_SECRET || "").trim(),
  );
}

export function isLinkedInSignInEnabled() {
  return isEnabledFlag(
    process.env.LINKEDIN_AUTH_ENABLED ||
      process.env.ADMIN_LINKEDIN_AUTH_ENABLED,
  );
}

export function isLinkedInSignInAvailable() {
  return isLinkedInSignInEnabled() && hasLinkedInCredentials();
}

export function assertLinkedInSignInEnabled() {
  if (!isLinkedInSignInEnabled()) {
    throw new Error("LinkedIn admin sign-in is not enabled.");
  }
}

function normalizeScopes(value) {
  return (Array.isArray(value) ? value : String(value || "").split(/[,\s]+/))
    .map((scope) => String(scope || "").trim())
    .filter(Boolean);
}

function getLinkedInScopes(extraScopes = []) {
  const configuredScopes = String(
    process.env.LINKEDIN_OAUTH_SCOPES || process.env.LINKEDIN_SCOPE || "",
  )
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
  return [
    ...new Set([
      ...REQUIRED_SCOPES,
      ...(configuredScopes.length > 0 ? configuredScopes : []),
      ...normalizeScopes(extraScopes),
    ]),
  ];
}

function getRedirectUri(request) {
  return `${getRequestOrigin(request)}${CALLBACK_PATH}`;
}

function getHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return "";
  }
}

export function getCanonicalLinkedInStartUrl(request, pathname) {
  const currentOrigin = getRequestOrigin(request);
  const configuredOrigin = getConfiguredSiteOrigin();

  if (
    !configuredOrigin ||
    isLocalOrigin(currentOrigin) ||
    isLocalOrigin(configuredOrigin) ||
    getHost(currentOrigin) === getHost(configuredOrigin)
  ) {
    return null;
  }

  return new URL(pathname, configuredOrigin);
}

function signValue(value) {
  return crypto
    .createHmac("sha256", requireAuthSecret())
    .update(value)
    .digest("base64url");
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function encodeStateCookie(value) {
  const payload = Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${payload}.${signValue(payload)}`;
}

function decodeStateCookie(value) {
  if (!value || !value.includes(".")) return null;

  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;

  try {
    if (!timingSafeStringEqual(signature, signValue(payload))) return null;

    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!parsed?.state || !parsed?.redirectUri || !parsed?.expiresAt) {
      return null;
    }

    if (Number(parsed.expiresAt) <= Date.now()) return null;

    return parsed;
  } catch {
    return null;
  }
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/admin",
    maxAge: STATE_MAX_AGE_SECONDS,
  };
}

export function createLinkedInAuthorizationRequest(request, options = {}) {
  assertLinkedInSignInEnabled();

  const {clientId} = getLinkedInCredentials();
  const state = crypto.randomBytes(32).toString("base64url");
  const redirectUri = getRedirectUri(request);
  const scopes = getLinkedInScopes(options.scopes);
  const authorizationUrl = new URL(AUTHORIZATION_URL);

  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("client_id", clientId);
  authorizationUrl.searchParams.set("redirect_uri", redirectUri);
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("scope", scopes.join(" "));

  return {
    authorizationUrl,
    state: {
      state,
      redirectUri,
      intent: options.intent || "sign_in",
      returnTo: options.returnTo || "",
      scopes,
      createdAt: Date.now(),
      expiresAt: Date.now() + STATE_MAX_AGE_SECONDS * 1000,
    },
  };
}

export function setLinkedInStateCookie(response, state) {
  response.cookies.set(STATE_COOKIE, encodeStateCookie(state), {
    ...stateCookieOptions(),
    expires: new Date(state.expiresAt),
  });
}

export function clearLinkedInStateCookie(response) {
  response.cookies.set(STATE_COOKIE, "", {
    ...stateCookieOptions(),
    maxAge: 0,
  });
}

export function getLinkedInStateFromRequest(request) {
  return decodeStateCookie(request.cookies.get(STATE_COOKIE)?.value);
}

export async function exchangeLinkedInAuthorizationCode({code, redirectUri}) {
  const {clientId, clientSecret} = getLinkedInCredentials();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const response = await fetch(ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body,
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.error_description || data.error || response.statusText;
    throw new Error(`LinkedIn token exchange failed: ${detail}`);
  }

  if (!data.access_token) {
    throw new Error("LinkedIn did not return an access token.");
  }

  return data;
}

export async function getLinkedInUserInfo(accessToken) {
  const response = await fetch(USERINFO_URL, {
    headers: {Authorization: `Bearer ${accessToken}`},
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = data.error_description || data.error || response.statusText;
    throw new Error(`LinkedIn userinfo request failed: ${detail}`);
  }

  const email = String(data.email || "")
    .trim()
    .toLowerCase();

  return {
    sub: String(data.sub || ""),
    name:
      data.name ||
      [data.given_name, data.family_name].filter(Boolean).join(" ") ||
      email,
    email,
    emailVerified: data.email_verified,
    picture: data.picture || "",
  };
}
