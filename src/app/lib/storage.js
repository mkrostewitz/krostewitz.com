import "server-only";

import crypto from "crypto";
import {PutObjectCommand, S3Client} from "@aws-sdk/client-s3";

const DEFAULT_MAX_UPLOAD_BYTES = 100 * 1024 * 1024;
const DEFAULT_MAX_CV_UPLOAD_BYTES = 10 * 1024 * 1024;
const DEFAULT_UPLOAD_PREFIX = "portfolio-posts";
const DEFAULT_CV_UPLOAD_PREFIX = "cv";
const DEFAULT_SITE_UPLOAD_PREFIX = "site-assets";
const SUPPORTED_POST_IMAGE_MIME_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
]);

export class UploadError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "UploadError";
    this.status = status;
  }
}

function firstConfigured(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }

  return "";
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function getSpacesConfig() {
  const bucket = firstConfigured([
    "DO_SPACES_BUCKET",
    "DIGITALOCEAN_SPACES_BUCKET",
  ]);
  const region = firstConfigured([
    "DO_SPACES_REGION",
    "DIGITALOCEAN_SPACES_REGION",
  ]);
  const accessKeyId = firstConfigured([
    "DO_SPACES_KEY",
    "DO_SPACES_ACCESS_KEY_ID",
    "DIGITALOCEAN_SPACES_KEY",
    "DIGITALOCEAN_SPACES_ACCESS_KEY_ID",
  ]);
  const secretAccessKey = firstConfigured([
    "DO_SPACES_SECRET",
    "DO_SPACES_SECRET_ACCESS_KEY",
    "DIGITALOCEAN_SPACES_SECRET",
    "DIGITALOCEAN_SPACES_SECRET_ACCESS_KEY",
  ]);
  const endpoint =
    firstConfigured([
      "DO_SPACES_ENDPOINT",
      "DIGITALOCEAN_SPACES_ENDPOINT",
    ]) || (region ? `https://${region}.digitaloceanspaces.com` : "");
  const publicUrl =
    firstConfigured([
      "DO_SPACES_PUBLIC_URL",
      "DIGITALOCEAN_SPACES_PUBLIC_URL",
      "DO_SPACES_CDN_URL",
      "DIGITALOCEAN_SPACES_CDN_URL",
    ]) ||
    (bucket && region
      ? `https://${bucket}.${region}.digitaloceanspaces.com`
      : "");
  const prefix =
    firstConfigured(["DO_SPACES_UPLOAD_PREFIX", "DIGITALOCEAN_SPACES_PREFIX"]) ||
    DEFAULT_UPLOAD_PREFIX;

  if (!bucket || !region || !accessKeyId || !secretAccessKey || !endpoint) {
    throw new UploadError("DigitalOcean Spaces is not configured.", 500);
  }

  return {
    bucket,
    region,
    accessKeyId,
    secretAccessKey,
    endpoint: trimTrailingSlash(endpoint),
    publicUrl: trimTrailingSlash(publicUrl),
    prefix: String(prefix).replace(/^\/+|\/+$/g, "") || DEFAULT_UPLOAD_PREFIX,
  };
}

function getMaxUploadBytes() {
  const configured = Number(process.env.POST_UPLOAD_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_UPLOAD_BYTES;
}

function getMaxCvUploadBytes() {
  const configured = Number(process.env.CV_UPLOAD_MAX_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_CV_UPLOAD_BYTES;
}

function getCvUploadPrefix() {
  const prefix =
    firstConfigured(["DO_SPACES_CV_PREFIX", "DIGITALOCEAN_SPACES_CV_PREFIX"]) ||
    DEFAULT_CV_UPLOAD_PREFIX;

  return String(prefix).replace(/^\/+|\/+$/g, "") || DEFAULT_CV_UPLOAD_PREFIX;
}

function getSiteUploadPrefix() {
  const prefix =
    firstConfigured([
      "DO_SPACES_SITE_PREFIX",
      "DIGITALOCEAN_SPACES_SITE_PREFIX",
    ]) || DEFAULT_SITE_UPLOAD_PREFIX;

  return String(prefix).replace(/^\/+|\/+$/g, "") || DEFAULT_SITE_UPLOAD_PREFIX;
}

function safeFileName(value) {
  const fallback = "upload";
  const clean = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return clean || fallback;
}

function encodeStorageKey(key) {
  return key.split("/").map(encodeURIComponent).join("/");
}

function getMediaType(mimeType) {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  return null;
}

function normalizeMimeType(value) {
  const mimeType = String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  return mimeType === "image/jpg" ? "image/jpeg" : mimeType;
}

function inferImageMimeType(file) {
  const mimeType = normalizeMimeType(file?.type);
  const originalName = String(file?.name || "");

  if (mimeType) return mimeType;
  if (/\.svg$/i.test(originalName)) return "image/svg+xml";
  if (/\.png$/i.test(originalName)) return "image/png";
  if (/\.jpe?g$/i.test(originalName)) return "image/jpeg";
  if (/\.webp$/i.test(originalName)) return "image/webp";
  if (/\.ico$/i.test(originalName)) return "image/x-icon";

  return "application/octet-stream";
}

function getSpacesClient(config) {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function putPublicObject({
  key,
  body,
  contentType,
  metadata,
  disposition,
  cacheControl,
}) {
  const config = getSpacesConfig();
  const client = getSpacesClient(config);

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ACL: "public-read",
      ContentType: contentType,
      ContentLength: body.byteLength,
      ContentDisposition: disposition,
      CacheControl: cacheControl,
      Metadata: metadata,
    })
  );

  return `${config.publicUrl}/${encodeStorageKey(key)}`;
}

export function getCvFileName(language) {
  return `Mathias_Krostewitz_CV_${String(language || "en").toUpperCase()}.pdf`;
}

export async function uploadPostAsset(file, user) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new UploadError("Upload file is required.");
  }

  const originalName = String(file.name || "");
  const mimeType = inferImageMimeType(file);
  const mediaType = getMediaType(mimeType);

  if (!mediaType) {
    throw new UploadError("Only image and video uploads are supported.");
  }

  if (mediaType === "image" && !SUPPORTED_POST_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new UploadError("Post images must be JPG, PNG, or GIF files.");
  }

  if (file.size > getMaxUploadBytes()) {
    throw new UploadError("The selected file is too large.");
  }

  const config = getSpacesConfig();
  const now = new Date();
  const datePrefix = now.toISOString().slice(0, 10);
  const key = `${config.prefix}/${datePrefix}/${crypto.randomUUID()}-${safeFileName(
    originalName
  )}`;
  const body = Buffer.from(await file.arrayBuffer());

  const url = await putPublicObject({
    key,
    body,
    contentType: mimeType,
    metadata: {
      uploadedBy: user?.email || "admin",
    },
  });

  return {
    type: mediaType,
    url,
    key,
    mimeType,
    fileName: originalName || null,
    size: body.byteLength,
  };
}

export async function uploadSiteAsset(file, kind, user) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new UploadError("Upload file is required.");
  }

  const originalName = String(file.name || "");
  const mimeType = inferImageMimeType(file);
  const mediaType = getMediaType(mimeType);

  if (mediaType !== "image") {
    throw new UploadError("Only image uploads are supported for site assets.");
  }

  if (file.size > getMaxUploadBytes()) {
    throw new UploadError("The selected file is too large.");
  }

  const safeKind = safeFileName(kind || "site-asset");
  const publicFileName = safeFileName(originalName || safeKind);
  const key = `${getSiteUploadPrefix()}/${safeKind}/${crypto.randomUUID()}-${publicFileName}`;
  const body = Buffer.from(await file.arrayBuffer());
  const url = await putPublicObject({
    key,
    body,
    contentType: mimeType,
    cacheControl: "no-cache",
    metadata: {
      uploadedBy: user?.email || "admin",
      purpose: "site-branding",
      kind: safeKind,
    },
  });

  return {
    type: "image",
    purpose: "site-branding",
    kind: safeKind,
    url,
    key,
    mimeType,
    fileName: originalName || publicFileName,
    size: body.byteLength,
  };
}

export async function uploadCvAsset(file, language, user) {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new UploadError("Upload file is required.");
  }

  const mimeType = String(file.type || "application/octet-stream").toLowerCase();
  const originalName = String(file.name || "");
  const isPdf =
    mimeType === "application/pdf" ||
    mimeType === "application/x-pdf" ||
    /\.pdf$/i.test(originalName);

  if (!isPdf) {
    throw new UploadError("Only PDF uploads are supported for CV files.");
  }

  if (file.size > getMaxCvUploadBytes()) {
    throw new UploadError("The selected CV file is too large.");
  }

  const normalizedLanguage = String(language || "en").toLowerCase();
  const publicFileName = getCvFileName(normalizedLanguage);
  const key = `${getCvUploadPrefix()}/${normalizedLanguage}/${publicFileName}`;
  const body = Buffer.from(await file.arrayBuffer());
  const url = await putPublicObject({
    key,
    body,
    contentType: "application/pdf",
    disposition: `attachment; filename="${publicFileName}"`,
    cacheControl: "no-cache",
    metadata: {
      uploadedBy: user?.email || "admin",
      purpose: "cv",
      language: normalizedLanguage,
    },
  });

  return {
    type: "pdf",
    language: normalizedLanguage,
    url,
    key,
    mimeType: "application/pdf",
    fileName: originalName || publicFileName,
    size: body.byteLength,
  };
}

export async function uploadLeadPhoto(file, user) {
  if (!file || typeof file.arrayBuffer !== 'function' || file.type !== 'image/jpeg') throw new UploadError('Upload a cropped JPG photo.');
  if (!file.size || file.size > 2 * 1024 * 1024) throw new UploadError('The cropped photo must be smaller than 2 MB.');
  const body = Buffer.from(await file.arrayBuffer());
  if (body[0] !== 0xff || body[1] !== 0xd8 || body[2] !== 0xff) throw new UploadError('The file is not a valid JPG photo.');
  const key = `lead-photos/${crypto.randomUUID()}.jpg`;
  const url = await putPublicObject({key, body, contentType: 'image/jpeg', metadata: {uploadedBy: user?.email || 'admin', purpose: 'lead-photo'}});
  return {type: 'image', url, key, mimeType: 'image/jpeg', size: body.byteLength};
}

export function allowedLeadPhotoHost(hostname) {
  const trusted = ['media.licdn.com', 'images.apollo.io', 'assets.apollo.io', 'lh3.googleusercontent.com'];
  try {trusted.push(new URL(getSpacesConfig().publicUrl).hostname);} catch { /* Remote Apollo photos work without upload storage configured. */ }
  return trusted.includes(hostname.toLowerCase());
}

export async function uploadTimelineDocument(file, user) {
  if (!file || typeof file.arrayBuffer !== "function") throw new UploadError("Select a PDF document.");
  if (!/\.pdf$/i.test(file.name || "") || file.size <= 0 || file.size > 10 * 1024 * 1024) throw new UploadError("Choose a PDF up to 10 MB.");
  const body = Buffer.from(await file.arrayBuffer());
  if (body.byteLength > 10 * 1024 * 1024 || body.subarray(0, 5).toString() !== "%PDF-") throw new UploadError("The file is not a valid PDF document.");
  const fileName = safeFileName(file.name).slice(0, 200);
  const id = crypto.randomUUID();
  const key = `${getSpacesConfig().prefix}/timeline/${id}/${fileName}`;
  const url = await putPublicObject({key, body, contentType: "application/pdf",
    disposition: `inline; filename="${fileName}"`,
    metadata: {uploadedBy: user?.email || "admin", purpose: "timeline-document"},
  });
  return {id, type: "pdf", url, fileName, size: body.byteLength};
}

export async function uploadAboutPhoto(file, user) {
  if (!file || typeof file.arrayBuffer !== "function" || !file.size || file.size > 10 * 1024 * 1024) {
    throw new UploadError("Choose a JPG, PNG, or WebP photo up to 10 MB.");
  }
  const body = Buffer.from(await file.arrayBuffer());
  let mimeType;
  let extension;
  if (body[0] === 0xff && body[1] === 0xd8 && body[2] === 0xff) {
    mimeType = "image/jpeg"; extension = "jpg";
  } else if (body.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mimeType = "image/png"; extension = "png";
  } else if (body.subarray(0, 4).toString() === "RIFF" && body.subarray(8, 12).toString() === "WEBP") {
    mimeType = "image/webp"; extension = "webp";
  } else {
    throw new UploadError("The photo must be a JPG, PNG, or WebP image.");
  }
  if (body.byteLength > 10 * 1024 * 1024) throw new UploadError("The photo must be 10 MB or smaller.");
  const key = `${getSiteUploadPrefix()}/about/${crypto.randomUUID()}.${extension}`;
  const url = await putPublicObject({key, body, contentType: mimeType, metadata: {uploadedBy: user?.email || "admin", purpose: "about-photo"}});
  return {type: "image", url, key, mimeType, size: body.byteLength};
}
