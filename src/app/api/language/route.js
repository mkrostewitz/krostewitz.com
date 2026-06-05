import {NextResponse} from "next/server";

import {
  FALLBACK_LANGUAGE,
  languageForCountryCode,
} from "../../../lib/languageDetection";
import {
  fetchIpGeolocationGeo,
  getClientIp,
  getCountryCodeFromHeaders,
  getIpGeolocationApiKey,
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

  const apiKey = getIpGeolocationApiKey();
  const ip = getClientIp(request);

  if (!apiKey || !ip) {
    return fallbackResponse();
  }

  try {
    const geo = await fetchIpGeolocationGeo(ip, apiKey);
    const countryCode = geo?.countryCode;

    if (!countryCode) {
      return fallbackResponse();
    }

    return languageResponse({
      countryCode,
      language: languageForCountryCode(countryCode),
      source: "ipgeolocation",
    });
  } catch (error) {
    console.warn("Unable to detect language from IPGeolocation", error);
    return fallbackResponse();
  }
}
