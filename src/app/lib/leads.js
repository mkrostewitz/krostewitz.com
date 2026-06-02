import "server-only";

import crypto from "crypto";
import {ObjectId} from "mongodb";

import {FALLBACK_LANGUAGE} from "../../lib/languageDetection";
import {
  getSupportedSiteLanguage,
  LANGUAGE_COOKIE_NAME,
} from "../../lib/siteLanguages";
import {getDb} from "./mongo";
import {normalizeCvLanguage} from "./cvFiles";

const LEADS_COLLECTION = "leads";
const DOWNLOAD_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24;

export const LEAD_SOURCE_TYPES = ["contact_form", "cv_download"];
export const LEAD_STATUSES = [
  "pending_verification",
  "pending",
  "won",
  "lost",
  // Legacy values kept readable so older lead records can still be listed.
  "new",
  "contacted",
  "qualified",
  "archived",
];
export const LEAD_REQUEST_TYPES = [
  "general",
  "headhunter",
  "employer",
  "potential_client",
  "fan",
  "other",
];

let indexPromise = null;

export class LeadValidationError extends Error {
  constructor(message, status = 400, errorCode = "contact.form.missingFields") {
    super(message);
    this.name = "LeadValidationError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

function getLeadsCollection(db) {
  return db.collection(LEADS_COLLECTION);
}

async function ensureLeadIndexes(db) {
  if (!indexPromise) {
    const leads = getLeadsCollection(db);
    indexPromise = Promise.all([
      leads.createIndex({createdAt: -1}),
      leads.createIndex({status: 1, createdAt: -1}),
      leads.createIndex({"source.type": 1, createdAt: -1}),
      leads.createIndex({"contact.email": 1, createdAt: -1}),
      leads.createIndex({downloadTokenHash: 1}, {sparse: true}),
    ]).catch((error) => {
      indexPromise = null;
      throw error;
    });
  }

  await indexPromise;
}

function toIsoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function cleanText(value, maxLength = 2000) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function languageFromAcceptLanguage(value) {
  const headerValue = String(value || "");

  for (const part of headerValue.split(",")) {
    const language = getSupportedSiteLanguage(part.split(";")[0]);
    if (language) return language;
  }

  return null;
}

function getPreferredLeadLanguage(input = {}, request, sourceType) {
  const explicitLanguage = getSupportedSiteLanguage(
    input.language || input.locale
  );
  if (explicitLanguage) return explicitLanguage;

  const cvLanguage =
    sourceType === "cv_download" ? getSupportedSiteLanguage(input.cvLanguage) : null;
  if (cvLanguage) return cvLanguage;

  const cookieLanguage = getSupportedSiteLanguage(
    request?.cookies?.get?.(LANGUAGE_COOKIE_NAME)?.value
  );
  if (cookieLanguage) return cookieLanguage;

  return (
    languageFromAcceptLanguage(request?.headers?.get?.("accept-language")) ||
    FALLBACK_LANGUAGE
  );
}

function isObjectId(value) {
  return /^[0-9a-f]{24}$/i.test(String(value || ""));
}

function toObjectId(value) {
  if (!isObjectId(value)) {
    throw new LeadValidationError("Invalid lead id.", 400);
  }

  return new ObjectId(String(value));
}

function normalizeSourceType(value) {
  const sourceType = String(value || "contact_form").trim();
  return LEAD_SOURCE_TYPES.includes(sourceType) ? sourceType : "contact_form";
}

function normalizeRequestType(value, sourceType) {
  const requestType = String(value || (sourceType === "cv_download" ? "" : "general"))
    .trim()
    .toLowerCase();

  if (!requestType && sourceType === "cv_download") {
    throw new LeadValidationError(
      "Request type is required.",
      400,
      "cv.form.validation.requestType"
    );
  }

  if (!LEAD_REQUEST_TYPES.includes(requestType || "general")) {
    throw new LeadValidationError(
      "Invalid request type.",
      400,
      "cv.form.validation.requestType"
    );
  }

  return requestType || "general";
}

function isSequentialPhoneNumber(digits, direction) {
  if (digits.length < 8) return false;

  for (let index = 1; index < digits.length; index += 1) {
    const previous = Number(digits[index - 1]);
    const current = Number(digits[index]);
    const expected = direction === "up" ? (previous + 1) % 10 : (previous + 9) % 10;

    if (current !== expected) return false;
  }

  return true;
}

function isWeakPhoneNumber(digits) {
  if (new Set(digits).size < 3) return true;
  if (isSequentialPhoneNumber(digits, "up")) return true;
  if (isSequentialPhoneNumber(digits, "down")) return true;
  return false;
}

function normalizePhone(value, required = false) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    if (required) {
      throw new LeadValidationError(
        "Phone number is required.",
        400,
        "cv.form.validation.phoneRequired"
      );
    }

    return "";
  }

  const plusCount = (rawValue.match(/\+/g) || []).length;
  const digits = rawValue.replace(/\D/g, "");
  const hasInvalidPlus = plusCount > 1 || (plusCount === 1 && rawValue[0] !== "+");

  if (
    hasInvalidPlus ||
    digits.length < 8 ||
    digits.length > 15 ||
    isWeakPhoneNumber(digits)
  ) {
    throw new LeadValidationError(
      "Phone number does not look valid.",
      400,
      "cv.form.validation.phone"
    );
  }

  return `${rawValue.startsWith("+") ? "+" : ""}${digits}`;
}

function decodeHeaderValue(value) {
  const headerValue = String(value || "").trim();
  if (!headerValue) return "";

  try {
    return decodeURIComponent(headerValue.replace(/\+/g, "%20"));
  } catch {
    return headerValue;
  }
}

function firstHeaderValue(value) {
  return decodeHeaderValue(String(value || "").split(",")[0]);
}

function getHeader(headers, names) {
  for (const name of names) {
    const value = headers.get(name);
    if (value) return value;
  }

  return "";
}

function getRequestTracking(request, input = {}) {
  const headers = request.headers;
  const forwardedFor = getHeader(headers, [
    "x-forwarded-for",
    "x-real-ip",
    "x-nf-client-connection-ip",
    "cf-connecting-ip",
    "true-client-ip",
    "client-ip",
  ]);
  const ip = firstHeaderValue(forwardedFor);
  const country = firstHeaderValue(
    getHeader(headers, [
      "x-vercel-ip-country",
      "cf-ipcountry",
      "x-country-code",
      "x-nf-geo-country",
      "x-appengine-country",
    ])
  );
  const state = firstHeaderValue(
    getHeader(headers, [
      "x-vercel-ip-country-region",
      "x-vercel-ip-region",
      "x-region",
      "x-nf-geo-subdivision",
      "x-appengine-region",
    ])
  );
  const city = firstHeaderValue(
    getHeader(headers, ["x-vercel-ip-city", "x-city", "x-nf-geo-city"])
  );
  const postalCode = firstHeaderValue(
    getHeader(headers, ["x-vercel-ip-postal-code", "x-postal-code"])
  );
  const latitude = firstHeaderValue(
    getHeader(headers, [
      "x-vercel-ip-latitude",
      "x-nf-geo-latitude",
      "cf-iplatitude",
      "x-latitude",
    ])
  );
  const longitude = firstHeaderValue(
    getHeader(headers, [
      "x-vercel-ip-longitude",
      "x-nf-geo-longitude",
      "x-nf-geo-lng",
      "cf-iplongitude",
      "x-longitude",
    ])
  );
  const timezone = firstHeaderValue(
    getHeader(headers, ["x-vercel-ip-timezone", "x-timezone"])
  );
  const address =
    firstHeaderValue(getHeader(headers, ["x-geo-address", "x-location"])) ||
    [city, state, country].filter(Boolean).join(", ");

  return {
    ip,
    country,
    state,
    address,
    city,
    postalCode,
    latitude,
    longitude,
    timezone,
    userAgent: cleanText(headers.get("user-agent"), 600),
    referrer: cleanText(headers.get("referer"), 1000),
    acceptLanguage: cleanText(headers.get("accept-language"), 300),
    pageUrl: cleanText(input.pageUrl, 1000),
    apiUrl: request.url,
    forwardedFor: cleanText(forwardedFor, 600),
  };
}

function normalizeLeadInput(input = {}, request) {
  const sourceType = normalizeSourceType(input.sourceType);
  const name = cleanText(input.name, 160);
  const email = normalizeEmail(input.email);
  const requestType = normalizeRequestType(input.requestType, sourceType);
  const phone = normalizePhone(input.phone, sourceType === "cv_download");
  const message = cleanText(input.message, 4000);
  const language = getPreferredLeadLanguage(input, request, sourceType);

  if (!name || !email) {
    throw new LeadValidationError(
      "Name and email are required.",
      400,
      "contact.form.missingFields"
    );
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new LeadValidationError(
      "A valid email address is required.",
      400,
      "contact.form.validation.email"
    );
  }

  if (sourceType === "contact_form" && message.length < 10) {
    throw new LeadValidationError(
      "Message is required.",
      400,
      "contact.form.validation.message"
    );
  }

  const context = {};
  if (sourceType === "cv_download") {
    try {
      context.cvLanguage = normalizeCvLanguage(input.cvLanguage || "en");
    } catch {
      throw new LeadValidationError("Unsupported CV language.", 400);
    }
  }

  return {
    language,
    contact: {name, email, phone},
    request: {type: requestType, message},
    source: {
      type: sourceType,
      label: sourceType === "cv_download" ? "CV download" : "Contact form",
      context,
    },
  };
}

function hashDownloadToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function normalizeLeadStatus(value) {
  const status = String(value || "").trim();

  if (["new", "contacted", "qualified"].includes(status)) return "pending";
  if (status === "archived") return "lost";
  if (LEAD_STATUSES.includes(status)) return status;

  return "pending";
}

function serializeLeadAction(action, index, fallbackId) {
  const text = cleanText(action?.text, 4000);
  if (!text) return null;

  return {
    id: cleanText(action?.id, 100) || `${fallbackId}:${index}`,
    type: cleanText(action?.type, 40) || "note",
    text,
    createdAt: toIsoDate(action?.createdAt),
    createdBy: action?.createdBy || null,
  };
}

function serializeLeadActions(document) {
  const documentId = String(document._id);
  const actions = Array.isArray(document.actions)
    ? document.actions
        .map((action, index) => serializeLeadAction(action, index, documentId))
        .filter(Boolean)
    : [];

  if (document.notes) {
    actions.push({
      id: `${documentId}:legacy-note`,
      type: "note",
      text: cleanText(document.notes, 4000),
      createdAt: toIsoDate(document.updatedAt || document.createdAt),
      createdBy: document.updatedBy || null,
      legacy: true,
    });
  }

  return actions.sort((first, second) => {
    const firstTime = first.createdAt ? new Date(first.createdAt).getTime() : 0;
    const secondTime = second.createdAt ? new Date(second.createdAt).getTime() : 0;
    return secondTime - firstTime;
  });
}

export function serializeLead(document) {
  if (!document) return null;

  const contact = document.contact || {};
  const request = document.request || {};
  const source = document.source || {};
  const actions = serializeLeadActions(document);

  return {
    id: String(document._id),
    status: normalizeLeadStatus(document.status),
    name: contact.name || document.name || "",
    email: contact.email || document.email || "",
    phone: contact.phone || document.phone || "",
    language:
      getSupportedSiteLanguage(
        document.language ||
          source.context?.language ||
          source.context?.cvLanguage ||
          document.tracking?.language
      ) || FALLBACK_LANGUAGE,
    requestType: request.type || document.requestType || "general",
    message: request.message || document.message || "",
    source: {
      type: source.type || document.sourceType || "contact_form",
      label: source.label || "",
      context: source.context || {},
    },
    tracking: document.tracking || {},
    notes: document.notes || "",
    actions,
    createdAt: toIsoDate(document.createdAt),
    updatedAt: toIsoDate(document.updatedAt),
    verifiedAt: toIsoDate(document.verifiedAt),
    downloadedAt: toIsoDate(document.downloadedAt),
    downloadTokenExpiresAt: toIsoDate(document.downloadTokenExpiresAt),
    downloadCount: Number(document.downloadCount) || 0,
    updatedBy: document.updatedBy || null,
  };
}

export async function createPendingLead(input, request) {
  const db = await getDb();
  await ensureLeadIndexes(db);

  const normalized = normalizeLeadInput(input, request);
  const now = new Date();
  const verificationCode = crypto.randomInt(100000, 999999).toString();
  const document = {
    ...normalized,
    status: "pending_verification",
    verification: {
      status: "pending",
      code: verificationCode,
      requestedAt: now,
    },
    tracking: getRequestTracking(request, input),
    createdAt: now,
    updatedAt: now,
    verifiedAt: null,
    downloadCount: 0,
  };

  const leads = getLeadsCollection(db);
  const result = await leads.insertOne(document);
  const lead = await leads.findOne({_id: result.insertedId});

  return {
    lead: serializeLead(lead),
    verificationCode,
  };
}

export async function verifyPendingLead({leadId, email, code}) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCode = String(code || "").trim();

  if (!normalizedEmail || !normalizedCode) {
    throw new LeadValidationError(
      "Email and verification code are required.",
      400,
      "contact.form.missingFields"
    );
  }

  const db = await getDb();
  await ensureLeadIndexes(db);

  const leads = getLeadsCollection(db);
  const query = {
    status: "pending_verification",
    "contact.email": normalizedEmail,
  };

  if (leadId) {
    query._id = toObjectId(leadId);
  }

  const existing = await leads.findOne(query, {sort: {createdAt: -1}});

  if (!existing) {
    throw new LeadValidationError(
      "Pending lead not found.",
      404,
      "contact.form.notFound"
    );
  }

  if (String(existing.verification?.code || "") !== normalizedCode) {
    throw new LeadValidationError(
      "Invalid verification code.",
      400,
      "contact.form.invalidCode"
    );
  }

  const now = new Date();
  const update = {
    status: "pending",
    "verification.status": "verified",
    "verification.code": null,
    verifiedAt: now,
    updatedAt: now,
  };
  let downloadToken = "";

  if (existing.source?.type === "cv_download") {
    downloadToken = crypto.randomBytes(32).toString("base64url");
    update.downloadTokenHash = hashDownloadToken(downloadToken);
    update.downloadTokenExpiresAt = new Date(now.getTime() + DOWNLOAD_TOKEN_MAX_AGE_MS);
  }

  const result = await leads.findOneAndUpdate(
    {_id: existing._id},
    {$set: update},
    {returnDocument: "after"}
  );
  const lead = result?.value || result;

  return {
    lead: serializeLead(lead),
    downloadToken,
  };
}

export async function getLeadByDownloadToken(token) {
  if (!token) return null;

  const db = await getDb();
  await ensureLeadIndexes(db);

  return getLeadsCollection(db).findOne({
    downloadTokenHash: hashDownloadToken(token),
    "source.type": "cv_download",
    "verification.status": "verified",
    downloadTokenExpiresAt: {$gt: new Date()},
  });
}

export async function recordLeadDownload(leadId) {
  const db = await getDb();
  await ensureLeadIndexes(db);

  await getLeadsCollection(db).updateOne(
    {_id: leadId},
    {
      $set: {
        downloadedAt: new Date(),
        updatedAt: new Date(),
      },
      $inc: {downloadCount: 1},
    }
  );
}

export async function getAdminLeads(filters = {}) {
  const db = await getDb();
  await ensureLeadIndexes(db);

  const query = {};
  if (filters.status && LEAD_STATUSES.includes(filters.status)) {
    query.status =
      filters.status === "pending"
        ? {$in: ["pending", "new", "contacted", "qualified"]}
        : filters.status;
  }
  if (filters.sourceType && LEAD_SOURCE_TYPES.includes(filters.sourceType)) {
    query["source.type"] = filters.sourceType;
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 150, 1), 300);
  const leads = await getLeadsCollection(db)
    .find(query)
    .sort({createdAt: -1})
    .limit(limit)
    .toArray();

  return leads.map(serializeLead);
}

export async function updateAdminLead(leadId, input = {}, user) {
  const db = await getDb();
  await ensureLeadIndexes(db);

  const _id = toObjectId(leadId);
  const now = new Date();
  const setUpdate = {
    updatedAt: now,
    updatedBy: user?.email || null,
  };
  const pushUpdate = {};

  if (Object.prototype.hasOwnProperty.call(input, "status")) {
    const status = String(input.status || "").trim();
    if (!LEAD_STATUSES.includes(status)) {
      throw new LeadValidationError("Invalid lead status.", 400);
    }
    setUpdate.status = status;
  }

  const actionText = cleanText(
    Object.prototype.hasOwnProperty.call(input, "actionText")
      ? input.actionText
      : input.action?.text,
    4000
  );

  if (actionText) {
    pushUpdate.actions = {
      id: crypto.randomUUID(),
      type: cleanText(input.actionType || input.action?.type, 40) || "note",
      text: actionText,
      createdAt: now,
      createdBy: user?.email || null,
    };
  }

  const leads = getLeadsCollection(db);
  const updateOperations = {$set: setUpdate};
  if (Object.keys(pushUpdate).length > 0) {
    updateOperations.$push = pushUpdate;
  }

  const result = await leads.updateOne({_id}, updateOperations);

  if (result.matchedCount === 0) {
    throw new LeadValidationError("Lead not found.", 404);
  }

  const lead = await leads.findOne({_id});

  if (!lead) {
    throw new LeadValidationError("Lead not found.", 404);
  }

  return serializeLead(lead);
}
