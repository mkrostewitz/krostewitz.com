import "server-only";

import {
  getDefaultSiteMetadata,
  getSiteMetadata,
  getSiteProfile,
} from "./siteProfile";

function clean(value) {
  return String(value || "").trim();
}

function getSiteUrl() {
  const value = clean(process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_BASE_URL);

  if (!value) return "https://krostewitz.com";
  return value.startsWith("http") ? value.replace(/\/+$/, "") : `https://${value}`;
}

export async function getLegalDetails() {
  let profile = {address: null};
  let metadata = getDefaultSiteMetadata();

  try {
    profile = await getSiteProfile();
    metadata = await getSiteMetadata();
  } catch (error) {
    console.warn("Unable to load legal profile details", error);
  }

  const siteName =
    clean(process.env.NEXT_PUBLIC_SITE_NAME) ||
    clean(metadata.title) ||
    "Mathias Krostewitz";
  const ownerName = clean(process.env.LEGAL_NAME) || siteName;
  const legalAddress =
    clean(process.env.LEGAL_ADDRESS) || clean(profile.address?.label);
  const email = clean(process.env.LEGAL_EMAIL || process.env.APPLE_MAIL_TO);
  const phone = clean(process.env.LEGAL_PHONE);
  const vatId = clean(process.env.LEGAL_VAT_ID);
  const businessRegister = clean(process.env.LEGAL_BUSINESS_REGISTER);
  const responsiblePerson =
    clean(process.env.LEGAL_CONTENT_RESPONSIBLE) || ownerName;
  const siteUrl = getSiteUrl();

  return {
    businessRegister,
    email,
    legalAddress,
    ownerName,
    phone,
    responsiblePerson,
    siteName,
    siteUrl,
    vatId,
    usesGoogleAnalytics: Boolean(
      clean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID)
    ),
  };
}
