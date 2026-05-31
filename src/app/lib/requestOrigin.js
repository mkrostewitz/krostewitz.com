import "server-only";

import {headers} from "next/headers";

const LOCAL_HOST_PATTERN = /^(localhost|127(?:\.\d{1,3}){3}|\[::1\]|::1)(?::|$)/i;

function firstHeaderValue(value) {
  return String(value || "")
    .split(",")[0]
    .trim();
}

function normalizeProtocol(value) {
  const protocol = firstHeaderValue(value).replace(/:$/, "").toLowerCase();
  return protocol === "http" || protocol === "https" ? `${protocol}:` : "";
}

function normalizeHost(value) {
  const host = firstHeaderValue(value);
  if (!host) return "";

  try {
    if (/^https?:\/\//i.test(host)) {
      return new URL(host).host;
    }
  } catch {
    return "";
  }

  return host.replace(/\/.*$/, "");
}

function normalizeOrigin(value) {
  const origin = String(value || "").trim().replace(/\/+$/, "");
  if (!origin) return "";

  try {
    if (/^https?:\/\//i.test(origin)) {
      const parsed = new URL(origin);
      return parsed.origin;
    }
  } catch {
    return "";
  }

  const host = normalizeHost(origin);
  if (!host) return "";

  const protocol = LOCAL_HOST_PATTERN.test(host) ? "http:" : "https:";
  return `${protocol}//${host}`;
}

function getConfiguredOrigin() {
  return normalizeOrigin(
    process.env.NEXT_PUBLIC_SITE_URL ||
      process.env.AUTH_BASE_URL ||
      process.env.URL ||
      process.env.DEPLOY_PRIME_URL ||
      process.env.DEPLOY_URL ||
      process.env.VERCEL_URL,
  );
}

export function getConfiguredSiteOrigin() {
  return getConfiguredOrigin();
}

export function isLocalOrigin(value) {
  try {
    return LOCAL_HOST_PATTERN.test(new URL(normalizeOrigin(value)).host);
  } catch {
    return LOCAL_HOST_PATTERN.test(normalizeHost(value));
  }
}

function getFallbackOrigin(fallbackUrl) {
  return normalizeOrigin(fallbackUrl) || getConfiguredOrigin() || "http://localhost:3000";
}

function protocolForHost(host, fallbackUrl) {
  const fallbackProtocol = normalizeProtocol(
    fallbackUrl ? new URL(fallbackUrl).protocol : "",
  );
  if (fallbackProtocol) return fallbackProtocol;
  return LOCAL_HOST_PATTERN.test(host) ? "http:" : "https:";
}

export function getRequestOrigin(request) {
  const fallbackUrl = request?.url || "";
  const headerStore = request?.headers;
  const host =
    normalizeHost(headerStore?.get("x-forwarded-host")) ||
    normalizeHost(headerStore?.get("host"));

  if (host) {
    const protocol =
      normalizeProtocol(headerStore?.get("x-forwarded-proto")) ||
      protocolForHost(host, fallbackUrl);
    return `${protocol}//${host}`;
  }

  return getFallbackOrigin(fallbackUrl);
}

export async function getCurrentRequestOrigin() {
  try {
    const headerStore = await headers();
    const host =
      normalizeHost(headerStore.get("x-forwarded-host")) ||
      normalizeHost(headerStore.get("host"));

    if (host) {
      const protocol =
        normalizeProtocol(headerStore.get("x-forwarded-proto")) ||
        (LOCAL_HOST_PATTERN.test(host) ? "http:" : "https:");
      return `${protocol}//${host}`;
    }
  } catch {
    return getFallbackOrigin();
  }

  return getFallbackOrigin();
}

export function getOriginHost(origin) {
  try {
    return new URL(origin).host;
  } catch {
    return normalizeHost(origin) || "this site";
  }
}
