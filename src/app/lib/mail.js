import crypto from "crypto";

import nodemailer from "nodemailer";

import {getDb} from "./mongo";

const CONTENT_COLLECTION = "site_content";
const MAIL_SETTINGS_ID = "mail_settings";
const SECRET_CIPHER_VERSION = "enc:v1";
const SECRET_AAD = "krostewitz:mail-settings";

const PROVIDER_ALIASES = {
  "apple-mail": "apple",
  icloud: "apple",
  google: "gmail",
  googlemail: "gmail",
  microsoft365: "microsoft",
  "microsoft-365": "microsoft",
  office365: "microsoft",
  "office-365": "microsoft",
  outlook: "microsoft",
};

export const MAIL_PROVIDER_PRESETS = {
  apple: {
    label: "Apple iCloud Mail",
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  gmail: {
    label: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  microsoft: {
    label: "Microsoft 365 / Outlook",
    host: "smtp.office365.com",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  custom: {
    label: "Custom SMTP",
    host: "",
    port: 587,
    secure: false,
    requireTLS: true,
  },
  disabled: {
    label: "Disabled",
    host: "",
    port: 587,
    secure: false,
    requireTLS: true,
  },
};

let cachedTransport = null;
let cachedTransportKey = "";

function cleanString(value) {
  return String(value || "").trim();
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

function firstValue(...values) {
  return values.map(cleanString).find(Boolean) || "";
}

function normalizeProvider(value) {
  const provider = cleanString(value || "apple")
    .toLowerCase()
    .replace(/[_\s]+/g, "-");

  return PROVIDER_ALIASES[provider] || provider || "apple";
}

function parseBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;

  const text = cleanString(value).toLowerCase();
  if (!text) return fallback;
  if (["1", "true", "yes", "on"].includes(text)) return true;
  if (["0", "false", "no", "off"].includes(text)) return false;
  return fallback;
}

function parseInteger(value, fallback, min, max) {
  const text = cleanString(value);
  if (!text) return fallback;

  const number = Number(text);
  if (!Number.isFinite(number)) return fallback;

  const rounded = Math.round(number);
  return Math.min(Math.max(rounded, min), max);
}

function splitRecipients(value) {
  return cleanString(value)
    .split(/[,\n;]/)
    .map(cleanString)
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function getProviderPreset(provider) {
  return MAIL_PROVIDER_PRESETS[provider] || MAIL_PROVIDER_PRESETS.custom;
}

function hasStoredMailConfig(config) {
  if (!config || typeof config !== "object") return false;

  return [
    "provider",
    "enabled",
    "host",
    "port",
    "secure",
    "requireTLS",
    "timeoutMs",
    "fromAddress",
    "fromName",
    "recipients",
    "replyTo",
    "username",
    "smtpPasswordEncrypted",
  ].some((key) => hasOwn(config, key));
}

function getEncryptionSecret() {
  const secret = firstValue(
    process.env.MAIL_ENCRYPTION_KEY,
    process.env.AUTH_SECRET,
    process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY
  );

  if (!secret || secret.length < 32) {
    throw new Error(
      "Mail password encryption needs MAIL_ENCRYPTION_KEY or AUTH_SECRET with at least 32 characters."
    );
  }

  return secret;
}

function getSecretKey() {
  return crypto.createHash("sha256").update(getEncryptionSecret()).digest();
}

function encryptSecret(value) {
  const text = cleanString(value);
  if (!text) return "";

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getSecretKey(), iv);
  cipher.setAAD(Buffer.from(SECRET_AAD));

  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    SECRET_CIPHER_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function decryptSecret(value) {
  const payload = cleanString(value);
  if (!payload) return "";

  const [prefix, version, iv, tag, encrypted] = payload.split(":");
  if (`${prefix}:${version}` !== SECRET_CIPHER_VERSION || !iv || !tag || !encrypted) {
    return "";
  }

  try {
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      getSecretKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAAD(Buffer.from(SECRET_AAD));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return "";
  }
}

function getMissingConfigKeys(config) {
  const missing = [];

  if (!config.host) missing.push("SMTP host");
  if (!config.auth.user) missing.push("SMTP username");
  if (!config.auth.pass) missing.push("SMTP password");
  if (!config.from.address) missing.push("From email");
  if (!config.to.length) missing.push("Notification recipient");

  return missing;
}

function createResolvedConfig(input) {
  const config = {
    provider: input.provider,
    providerLabel: input.providerLabel,
    host: input.host,
    port: input.port,
    secure: input.secure,
    requireTLS: input.requireTLS,
    auth: {
      user: input.user,
      pass: input.pass,
    },
    from: {
      address: input.fromAddress,
      name: input.fromName,
    },
    to: input.to,
    replyTo: input.replyTo,
    enabled: input.enabled,
    timeoutMs: input.timeoutMs,
    passwordConfigured: input.passwordConfigured,
    source: input.source,
    updatedAt: input.updatedAt || null,
    updatedBy: input.updatedBy || null,
  };
  const missing = ["disabled", "none", "off"].includes(config.provider)
    ? []
    : getMissingConfigKeys(config);

  return {
    ...config,
    configured: missing.length === 0,
    missing,
  };
}

function getEnvMailConfig() {
  const provider = normalizeProvider(
    firstValue(
      process.env.MAIL_PROVIDER,
      process.env.EMAIL_PROVIDER,
      process.env.SMTP_PROVIDER,
      process.env.APPLE_MAIL_PROVIDER
    )
  );
  const providerDisabled = ["disabled", "none", "off"].includes(provider);
  const preset = getProviderPreset(provider);
  const host = firstValue(
    process.env.SMTP_HOST,
    process.env.MAIL_HOST,
    process.env.APPLE_MAIL_HOST,
    preset.host
  );
  const port = parseInteger(
    firstValue(process.env.SMTP_PORT, process.env.MAIL_PORT),
    preset.port || 587,
    1,
    65535
  );
  const secure = parseBoolean(
    firstValue(process.env.SMTP_SECURE, process.env.MAIL_SECURE),
    typeof preset.secure === "boolean" ? preset.secure : port === 465
  );
  const user = firstValue(
    process.env.SMTP_USER,
    process.env.SMTP_USERNAME,
    process.env.MAIL_USER,
    process.env.EMAIL_USER,
    process.env.APPLE_MAIL_USER
  );
  const pass = firstValue(
    process.env.SMTP_PASS,
    process.env.SMTP_PASSWORD,
    process.env.MAIL_PASS,
    process.env.MAIL_PASSWORD,
    process.env.EMAIL_PASSWORD,
    process.env.APPLE_MAIL_APP_PASSWORD
  );
  const fromAddress = firstValue(
    process.env.MAIL_FROM,
    process.env.EMAIL_FROM,
    process.env.SMTP_FROM,
    process.env.APPLE_MAIL_FROM,
    user
  );
  const fromName = firstValue(
    process.env.MAIL_FROM_NAME,
    process.env.EMAIL_FROM_NAME,
    process.env.NEXT_PUBLIC_SITE_NAME,
    "Site"
  );
  const configuredRecipients = splitRecipients(
    firstValue(
      process.env.MAIL_TO,
      process.env.NOTIFICATION_EMAIL_TO,
      process.env.ADMIN_NOTIFICATION_EMAIL,
      process.env.NOTIFICATION_EMAIL,
      process.env.APPLE_MAIL_TO
    )
  );
  const to = unique(configuredRecipients.length ? configuredRecipients : [fromAddress]);
  const replyTo = firstValue(process.env.MAIL_REPLY_TO, process.env.EMAIL_REPLY_TO);
  const requireTLS = parseBoolean(
    firstValue(process.env.SMTP_REQUIRE_TLS, process.env.MAIL_REQUIRE_TLS),
    typeof preset.requireTLS === "boolean" ? preset.requireTLS : port === 587
  );
  const timeoutMs = parseInteger(
    firstValue(process.env.SMTP_TIMEOUT_MS, process.env.MAIL_TIMEOUT_MS),
    10000,
    1000,
    60000
  );
  const enabled = providerDisabled
    ? false
    : parseBoolean(
        firstValue(
          process.env.MAIL_NOTIFICATIONS_ENABLED,
          process.env.EMAIL_NOTIFICATIONS_ENABLED
        ),
        true
      );

  return createResolvedConfig({
    provider,
    providerLabel: providerDisabled ? "Disabled" : preset.label,
    host,
    port,
    secure,
    requireTLS,
    user,
    pass,
    fromAddress,
    fromName,
    to,
    replyTo,
    enabled,
    timeoutMs,
    passwordConfigured: Boolean(pass),
    source: "environment",
  });
}

async function getStoredMailConfig() {
  const db = await getDb();
  const document = await db.collection(CONTENT_COLLECTION).findOne({
    _id: MAIL_SETTINGS_ID,
  });

  if (!document) return null;

  const smtpPassword = document.smtpPasswordEncrypted
    ? decryptSecret(document.smtpPasswordEncrypted)
    : "";

  return {
    ...document,
    smtpPassword,
    passwordConfigured: Boolean(document.smtpPasswordEncrypted),
  };
}

function getStoredResolvedConfig(stored) {
  const provider = normalizeProvider(stored.provider);
  const providerDisabled = ["disabled", "none", "off"].includes(provider);
  const preset = getProviderPreset(provider);
  const port = parseInteger(stored.port, preset.port || 587, 1, 65535);
  const secure = parseBoolean(
    stored.secure,
    typeof preset.secure === "boolean" ? preset.secure : port === 465
  );
  const fromAddress = cleanString(stored.fromAddress);
  const to = unique(
    Array.isArray(stored.recipients) && stored.recipients.length
      ? stored.recipients
      : [fromAddress]
  );

  return createResolvedConfig({
    provider,
    providerLabel: providerDisabled ? "Disabled" : preset.label,
    host: firstValue(stored.host, preset.host),
    port,
    secure,
    requireTLS: parseBoolean(stored.requireTLS, port === 587),
    user: cleanString(stored.username),
    pass: cleanString(stored.smtpPassword),
    fromAddress,
    fromName: firstValue(stored.fromName, process.env.NEXT_PUBLIC_SITE_NAME, "Site"),
    to,
    replyTo: cleanString(stored.replyTo),
    enabled: providerDisabled ? false : parseBoolean(stored.enabled, true),
    timeoutMs: parseInteger(stored.timeoutMs, 10000, 1000, 60000),
    passwordConfigured: Boolean(stored.passwordConfigured),
    source: "database",
    updatedAt: stored.updatedAt,
    updatedBy: stored.updatedBy,
  });
}

export async function getMailConfig() {
  const stored = await getStoredMailConfig();
  if (hasStoredMailConfig(stored)) return getStoredResolvedConfig(stored);

  return getEnvMailConfig();
}

function getTransporter(config) {
  const passwordFingerprint = crypto
    .createHash("sha256")
    .update(config.auth.pass || "")
    .digest("hex");
  const key = JSON.stringify({
    host: config.host,
    port: config.port,
    secure: config.secure,
    user: config.auth.user,
    pass: passwordFingerprint,
    requireTLS: config.requireTLS,
    timeoutMs: config.timeoutMs,
  });

  if (cachedTransport && cachedTransportKey === key) return cachedTransport;

  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
    connectionTimeout: config.timeoutMs,
    greetingTimeout: config.timeoutMs,
    socketTimeout: config.timeoutMs,
    tls: {
      minVersion: "TLSv1.2",
    },
  });
  cachedTransportKey = key;

  return cachedTransport;
}

function mailbox(address, name) {
  if (!name) return address;
  return {address, name};
}

function serializeMailStatus(config) {
  return {
    provider: config.provider,
    providerLabel: config.providerLabel,
    configured: config.configured,
    enabled: config.enabled,
    active: config.enabled && config.configured,
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    timeoutMs: config.timeoutMs,
    from: config.from.address,
    fromName: config.from.name,
    recipients: config.to,
    replyTo: config.replyTo,
    username: config.auth.user,
    passwordConfigured: config.passwordConfigured,
    smtpPassword: "",
    clearSmtpPassword: false,
    source: config.source,
    missing: config.missing,
    updatedAt: config.updatedAt
      ? new Date(config.updatedAt).toISOString()
      : null,
    updatedBy: config.updatedBy || null,
  };
}

export async function getMailDeliveryStatus() {
  return serializeMailStatus(await getMailConfig());
}

export async function saveMailSettings(input = {}, user) {
  const db = await getDb();
  const current = await db.collection(CONTENT_COLLECTION).findOne({
    _id: MAIL_SETTINGS_ID,
  });
  const now = new Date();
  const next = {
    ...(current || {}),
    updatedAt: now,
    updatedBy: user?.email || null,
  };

  if (hasOwn(input, "provider")) {
    next.provider = normalizeProvider(input.provider);
  }

  if (hasOwn(input, "enabled")) {
    next.enabled = parseBoolean(input.enabled, true);
  }

  if (hasOwn(input, "host")) {
    next.host = cleanString(input.host);
  }

  if (hasOwn(input, "port")) {
    next.port = parseInteger(input.port, 587, 1, 65535);
  }

  if (hasOwn(input, "secure")) {
    next.secure = parseBoolean(input.secure, false);
  }

  if (hasOwn(input, "requireTLS")) {
    next.requireTLS = parseBoolean(input.requireTLS, true);
  }

  if (hasOwn(input, "timeoutMs")) {
    next.timeoutMs = parseInteger(input.timeoutMs, 10000, 1000, 60000);
  }

  if (hasOwn(input, "fromName")) {
    next.fromName = cleanString(input.fromName);
  }

  if (hasOwn(input, "from")) {
    next.fromAddress = cleanString(input.from);
  }

  if (hasOwn(input, "fromAddress")) {
    next.fromAddress = cleanString(input.fromAddress);
  }

  if (hasOwn(input, "recipients")) {
    next.recipients = unique(
      Array.isArray(input.recipients) ? input.recipients : splitRecipients(input.recipients)
    );
  }

  if (hasOwn(input, "replyTo")) {
    next.replyTo = cleanString(input.replyTo);
  }

  if (hasOwn(input, "username")) {
    next.username = cleanString(input.username);
  }

  if (input.clearSmtpPassword) {
    delete next.smtpPasswordEncrypted;
    delete next.smtpPasswordUpdatedAt;
  } else if (hasOwn(input, "smtpPassword") && cleanString(input.smtpPassword)) {
    next.smtpPasswordEncrypted = encryptSecret(input.smtpPassword);
    next.smtpPasswordUpdatedAt = now;
  }

  delete next.smtpPassword;
  delete next.clearSmtpPassword;
  delete next._id;
  delete next.createdAt;

  await db.collection(CONTENT_COLLECTION).updateOne(
    {_id: MAIL_SETTINGS_ID},
    {
      $set: next,
      $setOnInsert: {
        _id: MAIL_SETTINGS_ID,
        createdAt: now,
      },
    },
    {upsert: true}
  );

  cachedTransport = null;
  cachedTransportKey = "";

  return getMailDeliveryStatus();
}

export async function isMailConfigured() {
  const config = await getMailConfig();
  return config.enabled && config.configured;
}

export async function getAppleMailTransport() {
  const config = await getMailConfig();
  if (!config.enabled || !config.configured) return null;

  return getTransporter(config);
}

export async function isAppleMailConfigured() {
  return isMailConfigured();
}

export async function getDefaultSender() {
  const config = await getMailConfig();
  return mailbox(config.from.address, config.from.name);
}

export async function getDefaultRecipients() {
  const config = await getMailConfig();
  return config.to;
}

export async function sendMail({to, subject, text, html, replyTo}) {
  const config = await getMailConfig();

  if (!config.enabled) {
    return {ok: false, skipped: true, reason: "disabled"};
  }

  if (!config.configured) {
    return {
      ok: false,
      skipped: true,
      reason: "not_configured",
      missing: config.missing,
    };
  }

  const recipients = Array.isArray(to) ? to.filter(Boolean) : splitRecipients(to);
  const resolvedRecipients = recipients.length ? recipients : config.to;

  if (!resolvedRecipients.length) {
    return {ok: false, skipped: true, reason: "missing_recipient"};
  }

  const info = await getTransporter(config).sendMail({
    from: mailbox(config.from.address, config.from.name),
    to: resolvedRecipients,
    replyTo: replyTo || config.replyTo || undefined,
    subject,
    text,
    html,
  });

  return {
    ok: true,
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  };
}
