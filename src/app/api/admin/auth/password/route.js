import {NextResponse} from "next/server";

import {
  getConfiguredAdmin,
  getCurrentAdminUser,
  hashPassword,
  isPasswordSignInConfigured,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {getDb} from "../../../../lib/mongo";

export const runtime = "nodejs";

const USERS_COLLECTION = "users";
const MIN_PASSWORD_LENGTH = 12;

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

async function requireAdmin() {
  const user = await getCurrentAdminUser();
  if (!user) return null;

  return getConfiguredAdmin(user.email);
}

async function updateUserPassword(email, passwordHash) {
  const db = await getDb();
  return db.collection(USERS_COLLECTION).updateOne(
    {email: normalizeEmail(email)},
    {
      $set: {
        passwordHash,
        passwordUpdatedAt: new Date(),
        updatedAt: new Date(),
      },
      $unset: {
        password: "",
      },
    },
  );
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  return NextResponse.json({
    configured: isPasswordSignInConfigured(admin),
    email: admin.email,
  });
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const admin = await requireAdmin();
  if (!admin) return unauthorizedResponse();

  const {password} = await request.json().catch(() => ({}));

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`},
      {status: 400},
    );
  }

  const result = await updateUserPassword(
    admin.email,
    await hashPassword(password),
  );

  if (result.matchedCount !== 1) {
    return NextResponse.json(
      {error: "Admin user could not be updated."},
      {status: 404},
    );
  }

  return NextResponse.json({
    ok: true,
    configured: true,
    email: admin.email,
  });
}
