import "server-only";

import {isIP} from "node:net";

import {normalizeCountryCode} from "../../lib/languageDetection";

const IPGEOLOCATION_ENDPOINT = "https://api.ipgeolocation.io/v3/ipgeo";
const GEO_LOOKUP_TIMEOUT_MS = 2000;
const IP_HEADER_NAMES = [
  "x-site-client-ip",
  "cf-connecting-ip",
  "true-client-ip",
  "x-vercel-forwarded-for",
  "x-forwarded-for",
  "x-real-ip",
  "x-nf-client-connection-ip",
  "x-client-ip",
  "fastly-client-ip",
];
const COUNTRY_HEADER_NAMES = [
  "x-site-geo-country-code",
  "x-vercel-ip-country",
  "cf-ipcountry",
  "cloudfront-viewer-country",
  "x-country-code",
  "x-country",
  "x-nf-geo-country",
  "x-appengine-country",
  "x-geo-country",
  "fastly-client-country-code",
];
const UNKNOWN_COUNTRY_CODES = new Set(["T1", "XX", "ZZ"]);

function cleanString(value) {
  return String(value || "").trim();
}

function firstString(...values) {
  for (const value of values) {
    const text = cleanString(value);
    if (text) return text;
  }

  return "";
}

export function getIpGeolocationApiKey() {
  return (
    process.env.IPGEOLOCATION_API_KEY ||
    process.env.IP_GEOLOCATION_API_KEY ||
    process.env.IPGEOLOCATION_IO_API_KEY ||
    ""
  );
}

export function normalizeIp(value) {
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

export function isPrivateIp(ip) {
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

export function getClientIp(request) {
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

export function getCountryCodeFromHeaders(request) {
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

export async function fetchIpGeolocation(ip, apiKey = getIpGeolocationApiKey()) {
  if (!ip || !apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GEO_LOOKUP_TIMEOUT_MS);

  try {
    const url = new URL(IPGEOLOCATION_ENDPOINT);
    url.searchParams.set("apiKey", apiKey);
    url.searchParams.set("ip", ip);

    const response = await fetch(url, {
      cache: "no-store",
      headers: {Accept: "application/json"},
      signal: controller.signal,
    });

    if (!response.ok) return null;

    return response.json().catch(() => null);
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeIpGeolocationGeo(ipGeolocation = {}) {
  const data = ipGeolocation || {};
  const location = data.location || {};
  const timezoneData = data.time_zone || data.timezone || {};
  const countryCode = normalizeCountryCode(
    location.country_code2 ||
      location.country_code ||
      data.country_code2 ||
      data.country_code ||
      (/^[a-z]{2}$/i.test(cleanString(location.country)) ? location.country : "") ||
      (/^[a-z]{2}$/i.test(cleanString(data.country)) ? data.country : "")
  );
  const country = firstString(
    location.country_name,
    location.country_name_official,
    data.country_name,
    /^[a-z]{2}$/i.test(cleanString(location.country)) ? "" : location.country,
    /^[a-z]{2}$/i.test(cleanString(data.country)) ? "" : data.country,
    countryCode
  );
  const state = firstString(
    location.state_prov,
    location.state,
    location.region,
    data.state_prov,
    data.state,
    data.region
  );
  const stateCode = firstString(location.state_code, data.state_code);
  const city = firstString(location.city, data.city);
  const postalCode = firstString(
    location.zipcode,
    location.postal_code,
    location.postalCode,
    data.zipcode,
    data.postal_code,
    data.postalCode,
    data.postal
  );
  const timezone = firstString(
    timezoneData.name,
    timezoneData.id,
    location.timezone,
    data.timezone
  );

  return {
    country,
    countryCode,
    state,
    stateCode,
    city,
    postalCode,
    latitude: firstString(location.latitude, data.latitude),
    longitude: firstString(location.longitude, data.longitude),
    timezone,
  };
}

export async function fetchIpGeolocationGeo(
  ip,
  apiKey = getIpGeolocationApiKey()
) {
  const ipGeolocation = await fetchIpGeolocation(ip, apiKey).catch(() => null);
  const geo = normalizeIpGeolocationGeo(ipGeolocation);

  if (geo.country || geo.countryCode || geo.state || geo.city) {
    return {...geo, source: "ipgeolocation"};
  }

  return null;
}
