import {NextResponse} from "next/server";

import {
  createAdminSession,
  createMagicLinkChallenge,
  getConfiguredAdmin,
  isSameOriginRequest,
  setSessionCookie,
  verifyMagicLinkChallenge,
} from "../../../../lib/adminAuth";
import {getAppleMailTransport, getDefaultSender} from "../../../../lib/mail";

export const runtime = "nodejs";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function getAuthBaseUrl(request) {
  const configured =
    process.env.AUTH_BASE_URL ||
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configured) {
    const value = configured.trim().replace(/\/+$/, "");
    if (/^https?:\/\//i.test(value)) return value;

    const requestUrl = new URL(request.url);
    const protocol = /^(localhost|127\.0\.0\.1|\[::1\])(?::|$)/i.test(value)
      ? requestUrl.protocol
      : "https:";

    return `${protocol}//${value}`;
  }

  return new URL(request.url).origin;
}

function createMagicLink(request, challenge) {
  const url = new URL("/api/admin/auth/magic-link", getAuthBaseUrl(request));
  url.searchParams.set("challenge", challenge.challengeId);
  url.searchParams.set("token", challenge.token);
  return url.toString();
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const {email} = await request.json().catch(() => ({}));
  const admin = await getConfiguredAdmin(email);
  if (!admin || normalizeEmail(email) !== admin.email) {
    return NextResponse.json({ok: true});
  }

  const transporter = getAppleMailTransport();
  if (!transporter) {
    return NextResponse.json(
      {error: "Email transport is not configured."},
      {status: 500}
    );
  }

  let challenge;
  try {
    challenge = await createMagicLinkChallenge(admin);
  } catch (error) {
    console.error("Admin magic link challenge error", error);
    return NextResponse.json(
      {error: "Admin authentication is not fully configured."},
      {status: 500}
    );
  }

  const link = createMagicLink(request, challenge);

  try {
    await transporter.sendMail({
      from: getDefaultSender(),
      to: admin.email,
      subject: "Your krostewitz.com admin sign-in link",
      text: `Open this link to sign in to krostewitz.com admin:\n\n${link}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, change your password immediately.`,
    });
  } catch (error) {
    console.error("Admin magic link email error", error);
    return NextResponse.json(
      {error: "Unable to send magic link email."},
      {status: 500}
    );
  }

  return NextResponse.json({ok: true});
}

export async function GET(request) {
  const url = new URL(request.url);
  const challengeId = url.searchParams.get("challenge");
  const token = url.searchParams.get("token");
  const user = await verifyMagicLinkChallenge(challengeId, token);

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const session = await createAdminSession(user, {
    secondFactor: user.method,
  });
  const response = NextResponse.redirect(new URL("/admin/posts", request.url));
  setSessionCookie(response, session.token);

  return response;
}
