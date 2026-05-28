import {isIP} from "node:net";

import {NextResponse} from "next/server";

import {
  FALLBACK_LANGUAGE,
  languageForCountryCode,
  normalizeCountryCode,
} from "../../../lib/languageDetection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IPINFO_LITE_ENDPOINT = "https://api.ipinfo.io/lite";
const IPINFO_TIMEOUT_MS = 2000;
const IP_HEADER_NAMES = [
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-real-ip",
  "x-client-ip",
  "fastly-client-ip",
];
const COUNTRY_HEADER_NAMES = [
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-country-code",
  "x-appengine-country",
  "x-geo-country",
  "fastly-client-country-code",
];
const UNKNOWN_COUNTRY_CODES = new Set(["T1", "XX", "ZZ"]);

function getIpInfoToken() {
  return process.env.IP_INFO_TOKEN || process.env.IPINFO_TOKEN || "";
}

function normalizeIp(value) {
  let ip = String(value || "")
    .trim()
    .replace(/^"|"$/g, "");

  if (!ip || ip.toLowerCase() === "unknown") return null;

  if (ip.startsWith("[") && ip.includes("]")) {
    ip = ip.slice(1, ip.indexOf("]"));
  }

  const ipv4WithPort = ip.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/);
  if (ipv4WithPort) {
    ip = ipv4WithPort[1];
  }

  return isIP(ip) ? ip : null;
}

function isPrivateIp(ip) {
  if (ip.startsWith("::ffff:")) {
    return isPrivateIp(ip.slice(7));
  }

  if (isIP(ip) === 4) {
    const [first, second] = ip.split(".").map(Number);
    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function getClientIp(request) {
  for (const headerName of IP_HEADER_NAMES) {
    const headerValue = request.headers.get(headerName);
    if (!headerValue) continue;

    const candidates = headerValue.split(",");
    for (const candidate of candidates) {
      const ip = normalizeIp(candidate);
      if (ip && !isPrivateIp(ip)) return ip;
    }
  }

  const requestIp = normalizeIp(request.ip);
  if (requestIp && !isPrivateIp(requestIp)) return requestIp;

  return null;
}

function getCountryCodeFromHeaders(request) {
  for (const headerName of COUNTRY_HEADER_NAMES) {
    const countryCode = normalizeCountryCode(request.headers.get(headerName));

    if (
      /^[A-Z]{2}$/.test(countryCode) &&
      !UNKNOWN_COUNTRY_CODES.has(countryCode)
    ) {
      return countryCode;
    }
  }

  return null;
}

function languageResponse(data) {
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}

function fallbackResponse() {
  return languageResponse({
    countryCode: null,
    language: FALLBACK_LANGUAGE,
    source: "fallback",
  });
}

async function fetchIpInfo(ip, token) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IPINFO_TIMEOUT_MS);

  try {
    const url = new URL(`${IPINFO_LITE_ENDPOINT}/${ip}`);
    url.searchParams.set("token", token);

    const response = await fetch(url, {
      cache: "no-store",
      headers: {Accept: "application/json"},
      signal: controller.signal,
    });

    if (!response.ok) return null;

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request) {
  const headerCountryCode = getCountryCodeFromHeaders(request);

  if (headerCountryCode) {
    return languageResponse({
      countryCode: headerCountryCode,
      language: languageForCountryCode(headerCountryCode),
      source: "country-header",
    });
  }

  const token = getIpInfoToken();
  const ip = getClientIp(request);

  if (!token || !ip) {
    return fallbackResponse();
  }

  try {
    const ipInfo = await fetchIpInfo(ip, token);
    const countryCode = normalizeCountryCode(ipInfo?.country_code);

    if (!countryCode) {
      return fallbackResponse();
    }

    return languageResponse({
      countryCode,
      language: languageForCountryCode(countryCode),
      source: "ipinfo",
    });
  } catch (error) {
    console.warn("Unable to detect language from IPinfo", error);
    return fallbackResponse();
  }
}
