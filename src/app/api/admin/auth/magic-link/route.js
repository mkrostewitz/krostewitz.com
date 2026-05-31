import {NextResponse} from "next/server";

import {
  createAdminSession,
  createMagicLinkChallenge,
  getConfiguredAdmin,
  isSameOriginRequest,
  setSessionCookie,
  verifyMagicLinkChallenge,
} from "../../../../lib/adminAuth";
import {renderAdminMagicLinkEmail} from "../../../../lib/emailTemplates";
import {getAppleMailTransport, getDefaultSender} from "../../../../lib/mail";
import {getOriginHost, getRequestOrigin} from "../../../../lib/requestOrigin";

export const runtime = "nodejs";

function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function createMagicLink(request, challenge) {
  const url = new URL("/api/admin/auth/magic-link", getRequestOrigin(request));
  url.searchParams.set("challenge", challenge.challengeId);
  url.searchParams.set("token", challenge.token);
  return url.toString();
}

function normalizeRedirectPath(path) {
  const fallbackPath = "/admin/posts";
  const rawPath = String(path || "").trim();
  if (!rawPath) return fallbackPath;

  try {
    const url = new URL(rawPath, "https://admin.local");
    const isInternalAdminPath =
      url.origin === "https://admin.local" &&
      (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) &&
      url.pathname !== "/admin/login";

    if (!isInternalAdminPath) return fallbackPath;

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallbackPath;
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const {email, intent = "sign_in", redirectPath} = await request
    .json()
    .catch(() => ({}));
  const normalizedIntent =
    intent === "password_reset" ? "password_reset" : "sign_in";
  const admin = await getConfiguredAdmin(email);
  if (!admin || normalizeEmail(email) !== admin.email) {
    return NextResponse.json({ok: true});
  }

  const transporter = getAppleMailTransport();
  if (!transporter) {
    return NextResponse.json(
      {error: "Email transport is not configured."},
      {status: 500},
    );
  }

  let challenge;
  try {
    challenge = await createMagicLinkChallenge(admin, {
      intent: normalizedIntent,
      redirectPath: normalizeRedirectPath(
        normalizedIntent === "password_reset"
          ? "/admin/security?password=1"
          : redirectPath,
      ),
    });
  } catch (error) {
    console.error("Admin magic link challenge error", error);
    return NextResponse.json(
      {error: "Admin authentication is not fully configured."},
      {status: 500},
    );
  }

  const origin = getRequestOrigin(request);
  const siteHost = getOriginHost(origin);
  const link = createMagicLink(request, challenge);
  const isPasswordReset = normalizedIntent === "password_reset";

  try {
    await transporter.sendMail({
      from: getDefaultSender(),
      to: admin.email,
      subject: isPasswordReset
        ? `Reset your ${siteHost} admin password`
        : `Your ${siteHost} admin sign-in link`,
      text: isPasswordReset
        ? `Open this link to reset your ${siteHost} admin password:\n\n${link}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, review admin access and ignore this email.`
        : `Open this link to sign in to ${siteHost} admin:\n\n${link}\n\nThis link expires in 15 minutes and can only be used once. If you did not request it, change your password immediately.`,
      html: await renderAdminMagicLinkEmail({
        link,
        origin,
        siteHost,
        intent: normalizedIntent,
      }),
    });
  } catch (error) {
    console.error("Admin magic link email error", error);
    return NextResponse.json(
      {error: "Unable to send magic link email."},
      {status: 500},
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
  const response = NextResponse.redirect(
    new URL(normalizeRedirectPath(user.redirectPath), request.url),
  );
  setSessionCookie(response, session.token);

  return response;
}
