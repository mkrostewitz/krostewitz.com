import {NextResponse} from "next/server";

import {
  createTotpUri,
  generateTotpSecret,
  getConfiguredAdmin,
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
  verifyTotp,
} from "../../../../lib/adminAuth";
import {getDb} from "../../../../lib/mongo";
import {createQrSvg} from "../../../../lib/qrCode";

export const runtime = "nodejs";

const USERS_COLLECTION = "users";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function formatSecret(secret) {
  return String(secret || "")
    .replace(/\s/g, "")
    .replace(/(.{4})/g, "$1 ")
    .trim();
}

async function requireAdmin() {
  const user = await getCurrentAdminUser();
  if (!user) return null;

  return getConfiguredAdmin(user.email);
}

async function getUserDocument(email) {
  const db = await getDb();
  return db.collection(USERS_COLLECTION).findOne({
    email: normalizeEmail(email),
  });
}

async function updateUserDocument(email, update) {
  const db = await getDb();
  return db.collection(USERS_COLLECTION).updateOne(
    {email: normalizeEmail(email)},
    {
      ...update,
      $set: {
        ...(update.$set || {}),
        updatedAt: new Date(),
      },
    },
  );
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  return NextResponse.json({
    enabled: Boolean(admin.totpSecret),
    email: admin.email,
    issuer: admin.issuer,
  });
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  const secret = generateTotpSecret();
  const issuer = admin.issuer || process.env.ADMIN_TOTP_ISSUER;
  const otpauthUrl = createTotpUri({...admin, issuer}, secret);

  await updateUserDocument(admin.email, {
    $set: {
      pendingTotpSecret: secret,
      pendingTotpIssuer: issuer,
      pendingTotpCreatedAt: new Date(),
    },
  });

  return NextResponse.json({
    secret,
    manualSecret: formatSecret(secret),
    issuer,
    account: admin.email,
    otpauthUrl,
    qrSvg: await createQrSvg(otpauthUrl),
  });
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  const {code} = await request.json().catch(() => ({}));
  const user = await getUserDocument(admin.email);
  const pendingSecret = user?.pendingTotpSecret;

  if (!pendingSecret || !verifyTotp(code, pendingSecret)) {
    return NextResponse.json(
      {error: "Invalid authenticator code."},
      {status: 400},
    );
  }

  const issuer =
    user.pendingTotpIssuer || admin.issuer || process.env.ADMIN_TOTP_ISSUER;

  await updateUserDocument(admin.email, {
    $set: {
      totpSecret: pendingSecret,
      totpIssuer: issuer,
      totpEnabledAt: new Date(),
    },
    $unset: {
      pendingTotpSecret: "",
      pendingTotpIssuer: "",
      pendingTotpCreatedAt: "",
    },
  });

  return NextResponse.json({
    ok: true,
    enabled: true,
    issuer,
  });
}

export async function DELETE(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  await updateUserDocument(admin.email, {
    $unset: {
      totpSecret: "",
      totpIssuer: "",
      totpEnabledAt: "",
      pendingTotpSecret: "",
      pendingTotpIssuer: "",
      pendingTotpCreatedAt: "",
    },
  });

  return NextResponse.json({
    ok: true,
    enabled: false,
  });
}
