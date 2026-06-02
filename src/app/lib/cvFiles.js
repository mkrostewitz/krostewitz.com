import "server-only";

import {unstable_cache} from "next/cache";

import {supportedLanguages} from "../../lib/translationResources";
import {getDb} from "./mongo";
import {
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  PUBLIC_CACHE_TAGS,
  revalidatePublicTags,
} from "./publicCache";
import {getCvFileName} from "./storage";

const CONTENT_COLLECTION = "site_content";
const CV_DOWNLOADS_ID = "cv_downloads";

export class CvFileError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "CvFileError";
    this.status = status;
  }
}

function toIsoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function normalizeCvLanguage(value) {
  const language = String(value || "en")
    .split("-")[0]
    .toLowerCase();

  if (!supportedLanguages.includes(language)) {
    throw new CvFileError("Unsupported CV language.");
  }

  return language;
}

function getDefaultCvAsset(language) {
  const normalizedLanguage = normalizeCvLanguage(language);
  const fileName = getCvFileName(normalizedLanguage);

  return {
    type: "pdf",
    language: normalizedLanguage,
    url: "",
    key: null,
    mimeType: "application/pdf",
    fileName,
    size: null,
    updatedAt: null,
    updatedBy: null,
    source: "missing",
  };
}

function isRemoteUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function normalizeCvAsset(asset, language) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    throw new CvFileError("CV asset is required.");
  }

  const normalizedLanguage = normalizeCvLanguage(language || asset.language);
  const url = String(asset.url || "").trim();

  if (!url || !isRemoteUrl(url)) {
    throw new CvFileError("A remote CV asset URL is required.");
  }

  return {
    type: "pdf",
    language: normalizedLanguage,
    url,
    key: asset.key ? String(asset.key) : null,
    mimeType: asset.mimeType ? String(asset.mimeType) : "application/pdf",
    fileName: asset.fileName ? String(asset.fileName) : getCvFileName(normalizedLanguage),
    size: Number.isFinite(Number(asset.size)) ? Number(asset.size) : null,
    updatedAt: toIsoDate(asset.updatedAt),
    updatedBy: asset.updatedBy ? String(asset.updatedBy) : null,
    source: "digitalocean",
  };
}

function serializeCvDownloads(document) {
  const files = document?.files || {};

  return supportedLanguages.reduce((acc, language) => {
    const stored = files[language];
    try {
      acc[language] = stored
        ? normalizeCvAsset(stored, language)
        : getDefaultCvAsset(language);
    } catch {
      acc[language] = getDefaultCvAsset(language);
    }
    return acc;
  }, {});
}

export function getDefaultCvDownloads() {
  return serializeCvDownloads(null);
}

async function readCvDownloads() {
  const db = await getDb();
  const document = await db
    .collection(CONTENT_COLLECTION)
    .findOne({_id: CV_DOWNLOADS_ID});

  return serializeCvDownloads(document);
}

export const getCvDownloads = unstable_cache(
  readCvDownloads,
  ["public-cv-downloads"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.cv],
  }
);

export async function saveCvDownload(language, asset, user) {
  const normalizedLanguage = normalizeCvLanguage(language);
  const now = new Date();
  const normalizedAsset = normalizeCvAsset(
    {
      ...asset,
      language: normalizedLanguage,
      updatedAt: now,
      updatedBy: user?.email || null,
      source: "digitalocean",
    },
    normalizedLanguage
  );
  const db = await getDb();

  await db.collection(CONTENT_COLLECTION).updateOne(
    {_id: CV_DOWNLOADS_ID},
    {
      $set: {
        [`files.${normalizedLanguage}`]: normalizedAsset,
        updatedAt: now,
        updatedBy: user?.email || null,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    {upsert: true}
  );

  revalidatePublicTags(PUBLIC_CACHE_TAGS.cv);

  return readCvDownloads();
}
