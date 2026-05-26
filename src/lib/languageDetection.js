export const FALLBACK_LANGUAGE = "en";
export const MANUAL_LANGUAGE_STORAGE_KEY = "mkPreferredLanguage";

export const GERMAN_SPEAKING_COUNTRY_CODES = new Set([
  "AT",
  "CH",
  "DE",
  "LI",
  "LU",
]);

export function normalizeCountryCode(countryCode) {
  return String(countryCode || "")
    .trim()
    .toUpperCase();
}

export function normalizeLanguage(language) {
  return String(language || "")
    .trim()
    .split("-")[0]
    .toLowerCase();
}

export function languageForCountryCode(countryCode) {
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (GERMAN_SPEAKING_COUNTRY_CODES.has(normalizedCountryCode)) {
    return "de";
  }

  return FALLBACK_LANGUAGE;
}
