import "server-only";

import {getDb} from "./mongo";

const CONTENT_COLLECTION = "site_content";
const PROFILE_ID = "profile_settings";
const MAX_ADDRESS_LENGTH = 240;
const MAX_MAPBOX_ID_LENGTH = 140;
const MAX_METADATA_TITLE_LENGTH = 140;
const MAX_METADATA_DESCRIPTION_LENGTH = 320;
const MAX_METADATA_URL_LENGTH = 500;
const MAX_METADATA_TYPE_LENGTH = 120;

const DEFAULT_SITE_METADATA = {
  title: "Portfolio Site",
  description: "Personal website and portfolio.",
  iconUrl: "/icon.svg",
  iconType: "image/svg+xml",
  appIconUrl: "/icon.svg",
  appIconType: "image/svg+xml",
  logoUrl: "/logo.svg",
  logoType: "image/svg+xml",
};

class SiteProfileError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "SiteProfileError";
    this.status = status;
  }
}

export {SiteProfileError};

function cleanText(value, maxLength = MAX_ADDRESS_LENGTH) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanUrl(value) {
  return String(value || "").trim().slice(0, MAX_METADATA_URL_LENGTH);
}

function getIconSource(metadata = {}) {
  const icon = metadata.icon && typeof metadata.icon === "object"
    ? metadata.icon
    : {};
  const iconEntry = Array.isArray(metadata.icons?.icon)
    ? metadata.icons.icon[0]
    : metadata.icons?.icon;

  return {
    url: metadata.iconUrl || icon.url || iconEntry?.url,
    type: metadata.iconType || icon.type || iconEntry?.type,
  };
}

function getAssetSource(metadata = {}, name) {
  const asset = metadata[name] && typeof metadata[name] === "object"
    ? metadata[name]
    : {};
  const urlKey = `${name}Url`;
  const typeKey = `${name}Type`;

  return {
    url: metadata[urlKey] || asset.url,
    type: metadata[typeKey] || asset.type,
  };
}

function normalizeAssetUrl(value, fallback, strict = false) {
  const assetUrl = cleanUrl(value);

  if (!assetUrl) return fallback;

  if (assetUrl.startsWith("/") || /^https?:\/\//i.test(assetUrl)) {
    return assetUrl;
  }

  if (strict) {
    throw new SiteProfileError(
      "Asset URLs must be relative paths or http(s) URLs."
    );
  }

  return fallback;
}

export function normalizeSiteMetadata(input = {}, options = {}) {
  const metadata =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const title = cleanText(metadata.title, MAX_METADATA_TITLE_LENGTH);
  const description = cleanText(
    metadata.description,
    MAX_METADATA_DESCRIPTION_LENGTH
  );
  const iconSource = getIconSource(metadata);
  const appIconSource = getAssetSource(metadata, "appIcon");
  const logoSource = getAssetSource(metadata, "logo");
  const iconUrl = normalizeAssetUrl(
    iconSource.url,
    DEFAULT_SITE_METADATA.iconUrl,
    options.strict
  );
  const appIconUrl = normalizeAssetUrl(
    appIconSource.url,
    DEFAULT_SITE_METADATA.appIconUrl,
    options.strict
  );
  const logoUrl = normalizeAssetUrl(
    logoSource.url,
    DEFAULT_SITE_METADATA.logoUrl,
    options.strict
  );
  const iconType =
    cleanText(iconSource.type, MAX_METADATA_TYPE_LENGTH) ||
    DEFAULT_SITE_METADATA.iconType;
  const appIconType =
    cleanText(appIconSource.type, MAX_METADATA_TYPE_LENGTH) ||
    DEFAULT_SITE_METADATA.appIconType;
  const logoType =
    cleanText(logoSource.type, MAX_METADATA_TYPE_LENGTH) ||
    DEFAULT_SITE_METADATA.logoType;
  const icons = {
    icon: [{url: iconUrl, type: iconType}],
  };

  if (appIconUrl !== iconUrl) {
    icons.icon.push({url: appIconUrl, type: appIconType});
  }

  if (options.strict && !title) {
    throw new SiteProfileError("Site title is required.");
  }

  if (options.strict && !description) {
    throw new SiteProfileError("Site description is required.");
  }

  return {
    title: title || DEFAULT_SITE_METADATA.title,
    description: description || DEFAULT_SITE_METADATA.description,
    iconUrl,
    iconType,
    appIconUrl,
    appIconType,
    logoUrl,
    logoType,
    icons,
  };
}

export function getDefaultSiteMetadata() {
  return normalizeSiteMetadata();
}

export function toNextMetadata(metadata) {
  const normalized = normalizeSiteMetadata(metadata);

  return {
    title: normalized.title,
    description: normalized.description,
    icons: normalized.icons,
  };
}

function getCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeCoordinates(input = {}) {
  const source = Array.isArray(input) ? input : null;
  const longitude = getCoordinate(source ? source[0] : input.longitude ?? input.lng);
  const latitude = getCoordinate(source ? source[1] : input.latitude ?? input.lat);

  if (
    longitude === null ||
    latitude === null ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return {longitude, latitude};
}

export function normalizeSiteAddress(input) {
  if (!input || typeof input !== "object") return null;

  const label = cleanText(input.label || input.placeName || input.place_name);
  if (!label) return null;

  const coordinates = normalizeCoordinates(
    input.coordinates || input.center || {
      longitude: input.longitude,
      latitude: input.latitude,
    }
  );

  return {
    label,
    placeName: cleanText(input.placeName || input.place_name || label),
    mapboxId: cleanText(
      input.mapboxId || input.mapbox_id || input.id,
      MAX_MAPBOX_ID_LENGTH
    ),
    longitude: coordinates?.longitude ?? null,
    latitude: coordinates?.latitude ?? null,
    source: input.source === "manual" ? "manual" : "mapbox",
  };
}

function serializeProfile(document = {}) {
  return {
    address: normalizeSiteAddress(document.address),
    blogEnabled: document.blogEnabled !== false,
    metadata: normalizeSiteMetadata(document.metadata),
    updatedAt: document.updatedAt?.toISOString?.() || null,
    updatedBy: document.updatedBy || null,
  };
}

export async function getSiteProfile() {
  const db = await getDb();
  const document = await db
    .collection(CONTENT_COLLECTION)
    .findOne({_id: PROFILE_ID});

  return serializeProfile(document || {});
}

export async function getSiteMetadata() {
  const profile = await getSiteProfile();
  return profile.metadata;
}

export async function saveSiteProfile(input = {}, user) {
  const hasAddress = Object.prototype.hasOwnProperty.call(input, "address");
  const hasBlogEnabled = Object.prototype.hasOwnProperty.call(
    input,
    "blogEnabled"
  );
  const hasMetadata = Object.prototype.hasOwnProperty.call(input, "metadata");
  const address = normalizeSiteAddress(input.address);
  const metadata = hasMetadata
    ? normalizeSiteMetadata(input.metadata, {strict: true})
    : null;

  if (hasAddress && input.address && !address) {
    throw new SiteProfileError("Select a valid address or clear the field.");
  }

  const now = new Date();
  const document = {
    updatedAt: now,
    updatedBy: user?.email || null,
  };

  if (hasAddress) {
    document.address = address;
  }

  if (hasBlogEnabled) {
    document.blogEnabled = input.blogEnabled !== false;
  }

  if (hasMetadata) {
    document.metadata = metadata;
  }

  const insertDefaults = {createdAt: now};
  if (!hasBlogEnabled) {
    insertDefaults.blogEnabled = true;
  }

  const db = await getDb();
  await db.collection(CONTENT_COLLECTION).updateOne(
    {_id: PROFILE_ID},
    {
      $set: document,
      $setOnInsert: insertDefaults,
    },
    {upsert: true}
  );

  const nextDocument = await db
    .collection(CONTENT_COLLECTION)
    .findOne({_id: PROFILE_ID});

  return serializeProfile(nextDocument || document);
}

export async function isBlogEnabled() {
  const profile = await getSiteProfile();
  return profile.blogEnabled !== false;
}
