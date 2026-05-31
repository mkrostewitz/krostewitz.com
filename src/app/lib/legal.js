import "server-only";

import {
  getDefaultProfileName,
  getDefaultSiteMetadata,
  getSiteMetadata,
  getSiteProfile,
} from "./siteProfile";
import {getCurrentRequestOrigin} from "./requestOrigin";

function clean(value) {
  return String(value || "").trim();
}

async function getSiteUrl() {
  const requestOrigin = await getCurrentRequestOrigin();
  if (requestOrigin) return requestOrigin;

  const value = clean(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_BASE_URL,
  );

  if (!value) return "https://krostewitz.com";
  return value.startsWith("http")
    ? value.replace(/\/+$/, "")
    : `https://${value}`;
}

export async function getLegalDetails() {
  let profile = {address: null};
  let metadata = getDefaultSiteMetadata();
  const defaultMetadata = getDefaultSiteMetadata();
  const defaultName = getDefaultProfileName();

  try {
    profile = await getSiteProfile();
    metadata = profile.metadata || (await getSiteMetadata());
  } catch (error) {
    console.warn("Unable to load legal profile details", error);
  }

  const metadataName =
    clean(metadata.title) === clean(defaultMetadata.title)
      ? ""
      : clean(metadata.title);
  const profileName = clean(profile.name?.fullName) || metadataName;
  const siteName =
    profileName ||
    clean(process.env.NEXT_PUBLIC_SITE_NAME) ||
    clean(metadata.title) ||
    "Portfolio Site";
  const ownerName =
    profileName ||
    clean(process.env.LEGAL_NAME) ||
    defaultName.fullName ||
    siteName;
  const legalAddress =
    clean(profile.address?.label) || clean(process.env.LEGAL_ADDRESS);
  const email = clean(process.env.LEGAL_EMAIL || process.env.APPLE_MAIL_TO);
  const phone = clean(process.env.LEGAL_PHONE);
  const vatId = clean(process.env.LEGAL_VAT_ID);
  const businessRegister = clean(process.env.LEGAL_BUSINESS_REGISTER);
  const responsiblePerson =
    profileName || clean(process.env.LEGAL_CONTENT_RESPONSIBLE) || ownerName;
  const siteUrl = await getSiteUrl();

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
      clean(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID),
    ),
  };
}
