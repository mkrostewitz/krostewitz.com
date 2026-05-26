import "server-only";

import {supportedLanguages} from "../../lib/translationResources";
import {getDb} from "./mongo";
import {getCvFileName} from "./storage";

const CONTENT_COLLECTION = "site_content";
const CV_DOWNLOADS_ID = "cv_downloads";
const BUNDLED_CV_FILES = {
  de: "CV_Mathias_Krostewitz_DE.pdf",
  en: "CV_Mathias_Krostewitz_EN.pdf",
};

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
    url: `/data/${BUNDLED_CV_FILES[normalizedLanguage]}`,
    key: null,
    mimeType: "application/pdf",
    fileName,
    size: null,
    updatedAt: null,
    updatedBy: null,
    source: "local",
  };
}

function normalizeCvAsset(asset, language) {
  if (!asset || typeof asset !== "object" || Array.isArray(asset)) {
    throw new CvFileError("CV asset is required.");
  }

  const normalizedLanguage = normalizeCvLanguage(language || asset.language);
  const url = String(asset.url || "").trim();

  if (!url) {
    throw new CvFileError("CV asset URL is required.");
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
    source: asset.source === "local" ? "local" : "digitalocean",
  };
}

function serializeCvDownloads(document) {
  const files = document?.files || {};

  return supportedLanguages.reduce((acc, language) => {
    const stored = files[language];
    acc[language] = stored
      ? normalizeCvAsset(stored, language)
      : getDefaultCvAsset(language);
    return acc;
  }, {});
}

export function getDefaultCvDownloads() {
  return serializeCvDownloads(null);
}

export async function getCvDownloads() {
  const db = await getDb();
  const document = await db
    .collection(CONTENT_COLLECTION)
    .findOne({_id: CV_DOWNLOADS_ID});

  return serializeCvDownloads(document);
}

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

  return getCvDownloads();
}
