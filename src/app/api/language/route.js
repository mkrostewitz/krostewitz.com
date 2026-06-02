import {NextResponse} from "next/server";

import {
  FALLBACK_LANGUAGE,
  languageForCountryCode,
  normalizeCountryCode,
} from "../../../lib/languageDetection";
import {
  fetchIpInfoLite,
  getClientIp,
  getCountryCodeFromHeaders,
  getIpInfoToken,
} from "../../lib/requestGeo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
    const ipInfo = await fetchIpInfoLite(ip, token);
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
