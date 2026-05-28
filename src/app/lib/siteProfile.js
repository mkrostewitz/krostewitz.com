import "server-only";

import {getDb} from "./mongo";

const CONTENT_COLLECTION = "site_content";
const PROFILE_ID = "profile_settings";
const MAX_ADDRESS_LENGTH = 240;
const MAX_MAPBOX_ID_LENGTH = 140;

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

export async function saveSiteProfile(input = {}, user) {
  const hasAddress = Object.prototype.hasOwnProperty.call(input, "address");
  const hasBlogEnabled = Object.prototype.hasOwnProperty.call(
    input,
    "blogEnabled"
  );
  const address = normalizeSiteAddress(input.address);

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
