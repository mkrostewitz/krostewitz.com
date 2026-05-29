import "server-only";

import crypto from "crypto";
import {cookies} from "next/headers";
import {NextResponse} from "next/server";

import {getDb} from "./mongo";

const CHALLENGES_COLLECTION = "admin_auth_challenges";
const SESSIONS_COLLECTION = "admin_sessions";
const USERS_COLLECTION = "users";
const SESSION_COOKIE = "mk_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const EMAIL_CHALLENGE_MAX_AGE_MS = 1000 * 60 * 10;
const TOTP_CHALLENGE_MAX_AGE_MS = 1000 * 60 * 5;
const MAGIC_LINK_MAX_AGE_MS = 1000 * 60 * 15;

function getSessionSecret() {
  return (
    process.env.AUTH_SECRET ||
    process.env.AUTH_SESSION_SECRET ||
    process.env.ADMIN_SESSION_SECRET
  );
}

function requireSessionSecret() {
  const secret = getSessionSecret();
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters.");
  }
  return secret;
}

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function timingSafeStringEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));

  if (leftBuffer.length !== rightBuffer.length) return false;

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function signToken(token) {
  return crypto
    .createHmac("sha256", requireSessionSecret())
    .update(token)
    .digest("base64url");
}

function encodeSessionCookie(token) {
  return `${token}.${signToken(token)}`;
}

function decodeSessionCookie(value) {
  if (!value || !value.includes(".")) return null;

  const [token, signature] = value.split(".");
  if (!token || !signature) return null;

  try {
    if (!timingSafeStringEqual(signature, signToken(token))) return null;
  } catch {
    return null;
  }

  return token;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export function clearSessionCookie(response = NextResponse.json({ok: true})) {
  response.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}

export function setSessionCookie(response, token) {
  response.cookies.set(SESSION_COOKIE, encodeSessionCookie(token), {
    ...sessionCookieOptions(),
    expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000),
  });
  return response;
}

function isAdminUserDocument(user) {
  if (!user) return false;

  if (String(user._id || "") === "admin") return true;
  if (user.isAdmin === true) return true;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  if (
    Array.isArray(user.roles) &&
    user.roles.some((role) => String(role).toLowerCase() === "admin")
  ) {
    return true;
  }

  const configuredEmail = normalizeEmail(process.env.ADMIN_EMAIL);
  return configuredEmail && normalizeEmail(user.email) === configuredEmail;
}

function normalizeAdminUser(user) {
  if (!isAdminUserDocument(user)) return null;

  const email = normalizeEmail(user.email);
  if (!email) {
    return null;
  }

  return {
    email,
    name: user.name || email,
    password: user.password || "",
    passwordHash: user.passwordHash || "",
    totpSecret: user.totpSecret || "",
    issuer:
      user.totpIssuer ||
      process.env.AUTH_BASE_URL ||
      process.env.NEXT_PUBLIC_SITE_URL,
  };
}

export async function getConfiguredAdmin(email) {
  const normalizedEmail = normalizeEmail(email || process.env.ADMIN_EMAIL);
  const db = await getDb();
  const users = db.collection(USERS_COLLECTION);

  const query = normalizedEmail
    ? {email: normalizedEmail}
    : {
        $or: [
          {_id: "admin"},
          {isAdmin: true},
          {role: "admin"},
          {roles: "admin"},
        ],
      };

  const user = await users.findOne(query);
  return normalizeAdminUser(user);
}

export function isPasswordSignInConfigured(admin) {
  return Boolean(admin?.password || admin?.passwordHash);
}

export function getAvailableSecondFactors(admin) {
  const methods = ["email"];
  if (admin?.totpSecret) methods.unshift("totp");
  return methods;
}

export function hashChallengeCode(code) {
  return crypto
    .createHmac("sha256", requireSessionSecret())
    .update(String(code))
    .digest("hex");
}

function parseScryptHash(value) {
  const parts = String(value || "").split("$");

  if (parts.length !== 6 || parts[0] !== "scrypt") return null;

  const [, keylen, cost, salt, storedKey, digest] = parts;
  return {
    keylen: Number(keylen),
    cost: Number(cost),
    salt,
    storedKey,
    digest,
  };
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const keylen = 64;
  const cost = 16384;
  const digest = "sha512";
  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, {N: cost}, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("base64url"));
    });
  });

  return `scrypt$${keylen}$${cost}$${salt}$${key}$${digest}`;
}

async function verifyScryptPassword(password, storedHash) {
  const parsed = parseScryptHash(storedHash);
  if (!parsed) return false;

  const key = await new Promise((resolve, reject) => {
    crypto.scrypt(
      password,
      parsed.salt,
      parsed.keylen,
      {N: parsed.cost},
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey.toString("base64url"));
      },
    );
  });

  return timingSafeStringEqual(key, parsed.storedKey);
}

export async function verifyAdminPassword(password, admin) {
  if (!admin || !password) return false;

  if (admin.passwordHash) {
    return verifyScryptPassword(password, admin.passwordHash);
  }

  if (admin.password) {
    return timingSafeStringEqual(password, admin.password);
  }

  return false;
}

function normalizeBase32(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, "");
}

export function generateTotpSecret() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bytes = crypto.randomBytes(20);
  let bits = "";
  let secret = "";

  for (const byte of bytes) {
    bits += byte.toString(2).padStart(8, "0");
  }

  for (let index = 0; index + 5 <= bits.length; index += 5) {
    secret += alphabet[Number.parseInt(bits.slice(index, index + 5), 2)];
  }

  return secret;
}

function base32ToBuffer(value) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const cleanValue = normalizeBase32(value);
  let bits = "";

  for (const character of cleanValue) {
    const index = alphabet.indexOf(character);
    if (index === -1) continue;
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function generateHotp(secret, counter, digits = 6) {
  const key = base32ToBuffer(secret);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const hmac = crypto.createHmac("sha1", key).update(buffer).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(code % 10 ** digits).padStart(digits, "0");
}

export function verifyTotp(code, secret, options = {}) {
  const cleanCode = String(code || "").replace(/\s/g, "");
  if (!/^[0-9]{6}$/.test(cleanCode) || !secret) return false;

  const step = options.step || 30;
  const window = options.window || 1;
  const now = Math.floor(Date.now() / 1000 / step);

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = generateHotp(secret, now + offset);
    if (timingSafeStringEqual(cleanCode, expected)) return true;
  }

  return false;
}

export function createTotpUri(admin, secret = admin?.totpSecret) {
  if (!admin?.email || !secret) return "";

  const issuer =
    admin.issuer ||
    process.env.AUTH_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;
  const label = `${issuer}:${admin.email}`;
  const params = new URLSearchParams({
    secret: normalizeBase32(secret),
    issuer,
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  });

  return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
}

export async function createAuthChallenge(admin, method) {
  if (!admin) {
    throw new Error("Admin authentication is not configured.");
  }

  const db = await getDb();
  const now = new Date();
  const challengeId = crypto.randomUUID();
  const selectedMethod =
    method === "totp" && admin?.totpSecret ? "totp" : "email";
  const maxAge =
    selectedMethod === "totp"
      ? TOTP_CHALLENGE_MAX_AGE_MS
      : EMAIL_CHALLENGE_MAX_AGE_MS;
  const code =
    selectedMethod === "email"
      ? crypto.randomInt(100000, 999999).toString()
      : null;

  await db.collection(CHALLENGES_COLLECTION).insertOne({
    _id: challengeId,
    email: admin.email,
    method: selectedMethod,
    codeHash: code ? hashChallengeCode(code) : null,
    attempts: 0,
    createdAt: now,
    expiresAt: new Date(now.getTime() + maxAge),
  });

  return {
    challengeId,
    method: selectedMethod,
    code,
    expiresAt: new Date(now.getTime() + maxAge),
  };
}

export async function createMagicLinkChallenge(admin) {
  if (!admin) {
    throw new Error("Admin authentication is not configured.");
  }

  const db = await getDb();
  const now = new Date();
  const challengeId = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + MAGIC_LINK_MAX_AGE_MS);

  await db.collection(CHALLENGES_COLLECTION).insertOne({
    _id: challengeId,
    email: admin.email,
    method: "magic_link",
    tokenHash: hashToken(token),
    attempts: 0,
    createdAt: now,
    expiresAt,
  });

  return {
    challengeId,
    token,
    expiresAt,
  };
}

export async function verifyAuthChallenge(challengeId, code) {
  const db = await getDb();
  const challenges = db.collection(CHALLENGES_COLLECTION);
  const challenge = await challenges.findOne({
    _id: String(challengeId || ""),
    method: {$in: ["email", "totp"]},
    expiresAt: {$gt: new Date()},
    verifiedAt: {$exists: false},
  });

  if (!challenge || challenge.attempts >= 5) return null;

  const admin = await getConfiguredAdmin(challenge.email);
  if (!admin) return null;

  await challenges.updateOne(
    {_id: challenge._id},
    {$inc: {attempts: 1}, $set: {updatedAt: new Date()}},
  );

  const verified =
    challenge.method === "totp"
      ? verifyTotp(code, admin.totpSecret)
      : timingSafeStringEqual(hashChallengeCode(code), challenge.codeHash);

  if (!verified) return null;

  const result = await challenges.updateOne(
    {_id: challenge._id, verifiedAt: {$exists: false}},
    {$set: {verifiedAt: new Date()}},
  );

  if (result.modifiedCount !== 1) return null;

  return {
    email: admin.email,
    name: admin.name,
    method: challenge.method,
  };
}

export async function verifyMagicLinkChallenge(challengeId, token) {
  if (!token) return null;

  const db = await getDb();
  const challenges = db.collection(CHALLENGES_COLLECTION);
  const challenge = await challenges.findOne({
    _id: String(challengeId || ""),
    method: "magic_link",
    expiresAt: {$gt: new Date()},
    consumedAt: {$exists: false},
  });

  if (!challenge || challenge.attempts >= 5) return null;

  const admin = await getConfiguredAdmin(challenge.email);
  if (!admin) return null;

  await challenges.updateOne(
    {_id: challenge._id},
    {$inc: {attempts: 1}, $set: {updatedAt: new Date()}},
  );

  const tokenHash = hashToken(token);
  const verified = timingSafeStringEqual(tokenHash, challenge.tokenHash || "");

  if (!verified) return null;

  const result = await challenges.updateOne(
    {_id: challenge._id, consumedAt: {$exists: false}},
    {$set: {consumedAt: new Date(), verifiedAt: new Date()}},
  );

  if (result.modifiedCount !== 1) return null;

  return {
    email: admin.email,
    name: admin.name,
    method: "magic_link",
  };
}

export async function createAdminSession(user, metadata = {}) {
  const db = await getDb();
  const token = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.collection(SESSIONS_COLLECTION).insertOne({
    tokenHash: hashToken(token),
    email: user.email,
    name: user.name,
    secondFactor: metadata.secondFactor || null,
    createdAt: now,
    expiresAt,
  });

  return {token, expiresAt};
}

export async function revokeAdminSessionFromCookie() {
  const cookieStore = await cookies();
  const token = decodeSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!token) return;

  const db = await getDb();
  await db
    .collection(SESSIONS_COLLECTION)
    .deleteOne({tokenHash: hashToken(token)});
}

export async function getCurrentAdminUser() {
  const cookieStore = await cookies();
  const token = decodeSessionCookie(cookieStore.get(SESSION_COOKIE)?.value);
  if (!token) return null;

  const db = await getDb();
  const session = await db.collection(SESSIONS_COLLECTION).findOne({
    tokenHash: hashToken(token),
    expiresAt: {$gt: new Date()},
  });

  if (!session) return null;

  return {
    email: session.email,
    name: session.name,
    secondFactor: session.secondFactor,
  };
}

export function isSameOriginRequest(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const host = request.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({error: "Unauthorized"}, {status: 401});
}
