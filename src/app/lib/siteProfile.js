import "server-only";

import {unstable_cache} from "next/cache";

import {getDb} from "./mongo";
import {
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  PUBLIC_CACHE_TAGS,
  revalidatePublicTags,
} from "./publicCache";

const CONTENT_COLLECTION = "site_content";
const PROFILE_ID = "profile_settings";
const MAX_ADDRESS_LENGTH = 240;
const MAX_MAPBOX_ID_LENGTH = 140;
const MAX_METADATA_TITLE_LENGTH = 140;
const MAX_METADATA_DESCRIPTION_LENGTH = 320;
const MAX_METADATA_URL_LENGTH = 500;
const MAX_METADATA_TYPE_LENGTH = 120;
const MAX_PROFILE_NAME_LENGTH = 80;
const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

const DEFAULT_SITE_THEME = {
  primaryColor: "#5773ff",
  secondaryColor: "#2af5e6",
  tertiaryColor: "#f7f8f5",
};

const DEFAULT_DARK_SITE_THEME = {
  primaryColor: "#8ea2ff",
  secondaryColor: "#2af5e6",
  tertiaryColor: "#1b2a2a",
};

const DEFAULT_SITE_METADATA = {
  title: "Portfolio Site",
  description: "Personal website and portfolio.",
  iconUrl: "/icon.svg",
  iconType: "image/svg+xml",
  appIconUrl: "/icon.svg",
  appIconType: "image/svg+xml",
  logoUrl: "/logo.svg",
  logoType: "image/svg+xml",
  theme: DEFAULT_SITE_THEME,
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

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
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

function normalizeHexColor(value, fallback, options = {}) {
  const rawValue = String(value || "").trim();
  if (!rawValue) return fallback;

  const match = rawValue.match(HEX_COLOR_PATTERN);

  if (!match) {
    if (options.strict) {
      throw new SiteProfileError("Theme colors must be valid hex colors.");
    }

    return fallback;
  }

  const hex = match[1].toLowerCase();
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hex;

  return `#${normalized}`;
}

function getColorSource(source, field, legacyField) {
  return source[field] || source[legacyField];
}

export function normalizeSiteTheme(input = {}, options = {}) {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};

  return {
    primaryColor: normalizeHexColor(
      getColorSource(source, "primaryColor", "primary"),
      DEFAULT_SITE_THEME.primaryColor,
      options
    ),
    secondaryColor: normalizeHexColor(
      getColorSource(source, "secondaryColor", "secondary"),
      DEFAULT_SITE_THEME.secondaryColor,
      options
    ),
    tertiaryColor: normalizeHexColor(
      getColorSource(source, "tertiaryColor", "tertiary"),
      DEFAULT_SITE_THEME.tertiaryColor,
      options
    ),
  };
}

export function getDefaultSiteTheme() {
  return normalizeSiteTheme();
}

function hexToRgb(color) {
  const normalized = normalizeHexColor(color, DEFAULT_SITE_THEME.primaryColor);
  const hex = normalized.slice(1);

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({r, g, b}) {
  return `#${[r, g, b]
    .map((value) =>
      Math.round(value)
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function mixHexColor(color, target, weight) {
  const sourceRgb = hexToRgb(color);
  const targetRgb = hexToRgb(target);
  const sourceWeight = 1 - weight;

  return rgbToHex({
    r: sourceRgb.r * sourceWeight + targetRgb.r * weight,
    g: sourceRgb.g * sourceWeight + targetRgb.g * weight,
    b: sourceRgb.b * sourceWeight + targetRgb.b * weight,
  });
}

function rgbCss(color, alpha) {
  const {r, g, b} = hexToRgb(color);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function relativeLuminance(color) {
  const {r, g, b} = hexToRgb(color);

  return [r, g, b]
    .map((component) => {
      const channel = component / 255;
      return channel <= 0.03928
        ? channel / 12.92
        : ((channel + 0.055) / 1.055) ** 2.4;
    })
    .reduce(
      (total, component, index) =>
        total + component * [0.2126, 0.7152, 0.0722][index],
      0
    );
}

function contrastColor(color) {
  return relativeLuminance(color) > 0.52 ? "#111827" : "#ffffff";
}

function textOnSoftLight(color) {
  return relativeLuminance(color) > 0.62
    ? mixHexColor(color, "#000000", 0.62)
    : mixHexColor(color, "#000000", 0.38);
}

function textOnSoftDark(color) {
  return relativeLuminance(color) > 0.44
    ? color
    : mixHexColor(color, "#ffffff", 0.7);
}

function cssVariables(variables) {
  return Object.entries(variables)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join("\n");
}

function isDefaultSiteTheme(theme) {
  return Object.entries(DEFAULT_SITE_THEME).every(
    ([field, value]) => theme[field] === value
  );
}

function commonThemeVariables({primaryColor, secondaryColor, tertiaryColor}) {
  return {
    "--theme-primary": primaryColor,
    "--theme-secondary": secondaryColor,
    "--theme-tertiary": tertiaryColor,
    "--secondary-accent": secondaryColor,
    "--tertiary-accent": tertiaryColor,
    "--hero-highlight-start": secondaryColor,
    "--hero-highlight-end": primaryColor,
  };
}

export function toSiteThemeCss(input = {}) {
  const source =
    input?.theme && typeof input.theme === "object" ? input.theme : input;
  const theme = normalizeSiteTheme(source);
  const {primaryColor, secondaryColor, tertiaryColor} = theme;
  const darkTheme = isDefaultSiteTheme(theme) ? DEFAULT_DARK_SITE_THEME : theme;
  const {
    primaryColor: darkPrimaryColor,
    secondaryColor: darkSecondaryColor,
    tertiaryColor: darkTertiaryColor,
  } = darkTheme;
  const chipText = contrastColor(tertiaryColor);

  return `html:root {
${cssVariables({
  ...commonThemeVariables(theme),
  "--accent": primaryColor,
  "--accent-hover": mixHexColor(primaryColor, "#000000", 0.12),
  "--accent-contrast": contrastColor(primaryColor),
  "--accent-soft": rgbCss(primaryColor, 0.09),
  "--accent-focus": rgbCss(primaryColor, 0.16),
  "--accent-ring": rgbCss(primaryColor, 0.26),
  "--accent-shadow": rgbCss(primaryColor, 0.22),
  "--accent-shadow-strong": rgbCss(primaryColor, 0.3),
  "--accent-text": textOnSoftLight(primaryColor),
  "--secondary-accent-soft": rgbCss(secondaryColor, 0.12),
  "--chip-background": tertiaryColor,
  "--chip-border": mixHexColor(tertiaryColor, chipText, 0.2),
  "--chip-text": chipText,
})}
}

html:root[data-theme="dark"] {
${cssVariables({
  ...commonThemeVariables(darkTheme),
  "--accent": darkPrimaryColor,
  "--accent-hover": mixHexColor(darkPrimaryColor, "#ffffff", 0.18),
  "--accent-contrast": contrastColor(darkPrimaryColor),
  "--accent-soft": rgbCss(darkPrimaryColor, 0.18),
  "--accent-focus": rgbCss(darkPrimaryColor, 0.24),
  "--accent-ring": rgbCss(darkPrimaryColor, 0.32),
  "--accent-shadow": rgbCss(darkPrimaryColor, 0.2),
  "--accent-shadow-strong": rgbCss(darkPrimaryColor, 0.28),
  "--accent-text": textOnSoftDark(darkPrimaryColor),
  "--secondary-accent-soft": rgbCss(darkSecondaryColor, 0.18),
  "--chip-background": rgbCss(darkTertiaryColor, 0.2),
  "--chip-border": rgbCss(darkTertiaryColor, 0.34),
  "--chip-text": textOnSoftDark(darkTertiaryColor),
})}
}`;
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
  const themeSource =
    metadata.theme && typeof metadata.theme === "object"
      ? metadata.theme
      : metadata;
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
  const theme = normalizeSiteTheme(themeSource, options);
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
    theme,
    icons,
  };
}

export function getDefaultSiteMetadata() {
  return normalizeSiteMetadata();
}

function splitFullName(value) {
  const fullName = cleanText(value, MAX_PROFILE_NAME_LENGTH * 2);
  if (!fullName || fullName === DEFAULT_SITE_METADATA.title) {
    return {firstName: "", lastName: ""};
  }

  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return {firstName: fullName, lastName: ""};

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1),
  };
}

export function normalizeProfileName(input = {}, fallbackFullName = "") {
  const source =
    input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const fallback = splitFullName(source.fullName || source.name || fallbackFullName);
  const firstName = cleanText(
    source.firstName || source.givenName || fallback.firstName,
    MAX_PROFILE_NAME_LENGTH
  );
  const lastName = cleanText(
    source.lastName || source.familyName || fallback.lastName,
    MAX_PROFILE_NAME_LENGTH
  );
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    firstName,
    lastName,
    fullName,
  };
}

export function getDefaultProfileName() {
  return normalizeProfileName(
    null,
    process.env.NEXT_PUBLIC_SITE_NAME || process.env.LEGAL_NAME || ""
  );
}

function normalizeKoalendarBookingUrl(value, options = {}) {
  const bookingUrl = cleanUrl(value);

  if (!bookingUrl) return "";

  try {
    const url = new URL(bookingUrl);
    const hostname = url.hostname.toLowerCase();
    const isKoalendarHost =
      hostname === "koalendar.com" || hostname.endsWith(".koalendar.com");

    if (url.protocol !== "https:" || !isKoalendarHost) {
      throw new Error("Invalid Koalendar URL.");
    }

    return url.toString();
  } catch {
    if (options.strict) {
      throw new SiteProfileError(
        "Koalendar booking URL must use HTTPS and the koalendar.com domain."
      );
    }

    return "";
  }
}

export function getDefaultKoalendarIntegration() {
  return {
    enabled: false,
    bookingUrl: "",
  };
}

export function normalizeKoalendarIntegration(input = {}, options = {}) {
  const source =
    typeof input === "string"
      ? {bookingUrl: input}
      : input && typeof input === "object" && !Array.isArray(input)
        ? input
        : {};
  const defaultIntegration = getDefaultKoalendarIntegration();
  const hasBookingUrl =
    Object.prototype.hasOwnProperty.call(source, "bookingUrl") ||
    Object.prototype.hasOwnProperty.call(source, "url") ||
    Object.prototype.hasOwnProperty.call(source, "href");
  const bookingUrl = normalizeKoalendarBookingUrl(
    hasBookingUrl
      ? source.bookingUrl || source.url || source.href || ""
      : defaultIntegration.bookingUrl,
    options
  );
  const enabled = normalizeBoolean(source.enabled, defaultIntegration.enabled);

  if (options.strict && enabled && !bookingUrl) {
    throw new SiteProfileError(
      "Koalendar booking URL is required when the integration is enabled."
    );
  }

  return {
    enabled: enabled && Boolean(bookingUrl),
    bookingUrl,
  };
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
  const metadata = normalizeSiteMetadata(document.metadata);
  const fallbackName =
    metadata.title !== DEFAULT_SITE_METADATA.title ? metadata.title : "";
  const name = normalizeProfileName(document.name, fallbackName);

  return {
    address: normalizeSiteAddress(document.address),
    blogEnabled: document.blogEnabled !== false,
    koalendar: normalizeKoalendarIntegration(document.koalendar),
    metadata,
    name,
    updatedAt: document.updatedAt?.toISOString?.() || null,
    updatedBy: document.updatedBy || null,
  };
}

async function readSiteProfile() {
  const db = await getDb();
  const collection = db.collection(CONTENT_COLLECTION);
  let document = await collection.findOne({_id: PROFILE_ID});
  const defaultName = getDefaultProfileName();

  if (!document) {
    await collection.updateOne(
      {_id: PROFILE_ID},
      {
        $setOnInsert: {
          koalendar: getDefaultKoalendarIntegration(),
          name: defaultName,
          createdAt: new Date(),
        },
      },
      {upsert: true}
    );

    document = await collection.findOne({_id: PROFILE_ID});
  } else if (document.koalendar === undefined) {
    const koalendar = getDefaultKoalendarIntegration();

    await collection.updateOne({_id: PROFILE_ID}, {$set: {koalendar}});
    document = {...document, koalendar};
  }

  if (document && document.name === undefined) {
    const metadata = normalizeSiteMetadata(document.metadata);
    const fallbackName =
      metadata.title !== DEFAULT_SITE_METADATA.title
        ? metadata.title
        : defaultName.fullName;
    const name = normalizeProfileName(document.name, fallbackName);

    await collection.updateOne({_id: PROFILE_ID}, {$set: {name}});
    document = {...document, name};
  }

  return serializeProfile(document || {});
}

export const getSiteProfile = unstable_cache(
  readSiteProfile,
  ["public-site-profile"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.profile],
  }
);

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
  const hasKoalendar = Object.prototype.hasOwnProperty.call(input, "koalendar");
  const hasName = Object.prototype.hasOwnProperty.call(input, "name");
  const address = normalizeSiteAddress(input.address);
  const metadata = hasMetadata
    ? normalizeSiteMetadata(input.metadata, {strict: true})
    : null;
  const koalendar = hasKoalendar
    ? normalizeKoalendarIntegration(input.koalendar, {strict: true})
    : null;
  const name = hasName
    ? normalizeProfileName(input.name, metadata?.title || "")
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

  if (hasName) {
    document.name = name;
  }

  if (hasKoalendar) {
    document.koalendar = koalendar;
  }

  const insertDefaults = {createdAt: now};
  if (!hasBlogEnabled) {
    insertDefaults.blogEnabled = true;
  }
  if (!hasKoalendar) {
    insertDefaults.koalendar = getDefaultKoalendarIntegration();
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

  revalidatePublicTags(
    PUBLIC_CACHE_TAGS.profile,
    PUBLIC_CACHE_TAGS.translations
  );

  return serializeProfile(nextDocument || document);
}

export async function isBlogEnabled() {
  const profile = await getSiteProfile();
  return profile.blogEnabled !== false;
}
