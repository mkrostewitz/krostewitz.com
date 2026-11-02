import {normalizeSequenceRules, normalizeSourceSequenceRules} from "./apolloRouting.mjs";
import crypto from "node:crypto";

function secretKey(secret) {
  if (typeof secret !== "string" || secret.length < 32) throw new Error("Apollo key encryption requires AUTH_SECRET with at least 32 characters.");
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptApolloKey(value, secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", secretKey(secret), iv);
  cipher.setAAD(Buffer.from("apollo-api-key:v1"));
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(":");
}

export function decryptApolloKey(value, secret) {
  const [version, iv, tag, data] = value.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Invalid saved Apollo key.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", secretKey(secret), Buffer.from(iv, "base64url"));
  decipher.setAAD(Buffer.from("apollo-api-key:v1"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString("utf8");
}

export function apolloSettingsStatus(document) {
  const keySource = document?.apiKeyEncrypted ? "saved" : null;
  return {enabled: document?.enabled === true, configured: Boolean(keySource), available: document?.enabled === true && Boolean(keySource), keySource,
    listId: document?.listId || "", listName: document?.listName || "website_leads",
    listEnabled: document?.listEnabled === true,
    sequenceEnabled: document?.sequenceEnabled === true,
    sourceSequenceRules: document?.sourceSequenceRules || [], sequenceRules: document?.sequenceRules || [], sequenceName: document?.sequenceName || "",
    sequenceId: document?.sequenceId || "", emailAccountId: document?.emailAccountId || ""};
}

export function apolloSettingsPatch(input, secret) {
  if (!input || typeof input.enabled !== "boolean") throw new Error("Choose whether Apollo enrichment is enabled.");
  if (input.apiKey !== undefined && (typeof input.apiKey !== "string" || input.apiKey.length > 2000 || /[\r\n]/.test(input.apiKey))) throw new Error("Enter a valid Apollo API key.");
  if (input.removeKey && input.apiKey?.trim()) throw new Error("Remove the saved key or enter a replacement, not both.");
  const patch = {enabled: input.enabled};
  if (input.sourceSequenceRules !== undefined) patch.sourceSequenceRules = normalizeSourceSequenceRules(input.sourceSequenceRules);
  if (input.sequenceRules !== undefined) patch.sequenceRules = normalizeSequenceRules(input.sequenceRules);
  if (input.sequenceName !== undefined) patch.sequenceName = typeof input.sequenceName === "string" ? input.sequenceName.trim().slice(0, 200) : "";
  for (const field of ["listEnabled", "sequenceEnabled"]) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== "boolean") throw new Error("Choose whether list and sequence actions are enabled.");
      patch[field] = input[field];
    }
  }
  for (const field of ["sequenceId", "emailAccountId", "listId"]) {
    if (input[field] !== undefined) {
      if (typeof input[field] !== "string" || (input[field].trim() && !/^[a-f0-9]{24}$/i.test(input[field].trim()))) throw new Error("Enter a valid Apollo list, sequence or email account ID (24 hexadecimal characters).");
      patch[field] = input[field].trim();
    }
  }
  if (input.removeKey === true) {
    patch.apiKeyEncrypted = "";
    patch.enabled = false;
  }
  else if (input.apiKey?.trim()) patch.apiKeyEncrypted = encryptApolloKey(input.apiKey.trim(), secret);
  return patch;
}

// Validate merged settings: manual per-lead choices need no default sequence.
export function validateApolloEnrollmentSettings(settings) {
  if (settings.sequenceEnabled && (!settings.listEnabled || !settings.emailAccountId)) {
    throw new Error("Enable the Apollo list action and choose a sending account before enabling sequence enrollment. Category rules and a fallback sequence are optional.");
  }
}
