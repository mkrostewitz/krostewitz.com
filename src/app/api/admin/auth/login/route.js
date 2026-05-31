import {NextResponse} from "next/server";

import {
  createAuthChallenge,
  getAvailableSecondFactors,
  getConfiguredAdmin,
  isSameOriginRequest,
  isPasswordSignInConfigured,
  verifyAdminPassword,
} from "../../../../lib/adminAuth";
import {
  getAppleMailTransport,
  getDefaultSender,
  isAppleMailConfigured,
} from "../../../../lib/mail";
import {renderAdminCodeEmail} from "../../../../lib/emailTemplates";
import {getOriginHost, getRequestOrigin} from "../../../../lib/requestOrigin";

export const runtime = "nodejs";

function invalidLogin() {
  return NextResponse.json(
    {error: "Invalid email or password."},
    {status: 401},
  );
}

function getConfiguredSecondFactors(admin) {
  return getAvailableSecondFactors(admin).filter(
    (method) => method !== "email" || isAppleMailConfigured(),
  );
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const {
    email,
    password,
    method,
    intent = "credentials",
  } = await request.json().catch(() => ({}));
  const requestedEmail = String(email || "")
    .trim()
    .toLowerCase();

  const admin = await getConfiguredAdmin(requestedEmail);
  if (!admin || requestedEmail !== admin.email) return invalidLogin();

  if (!isPasswordSignInConfigured(admin)) {
    return NextResponse.json(
      {error: "Password sign-in is not configured."},
      {status: 500},
    );
  }

  const passwordOk = await verifyAdminPassword(password, admin);
  if (!passwordOk) return invalidLogin();

  const methods = getConfiguredSecondFactors(admin);
  if (methods.length === 0) {
    return NextResponse.json(
      {error: "No second factor is configured."},
      {status: 500},
    );
  }

  if (intent !== "challenge") {
    return NextResponse.json({
      authenticated: true,
      methods,
    });
  }

  const selectedMethod = methods.includes(method) ? method : methods[0];

  let challenge;
  try {
    challenge = await createAuthChallenge(admin, selectedMethod);
  } catch (error) {
    console.error("Admin auth challenge error", error);
    return NextResponse.json(
      {error: "Admin authentication is not fully configured."},
      {status: 500},
    );
  }

  if (challenge.method === "email") {
    const transporter = getAppleMailTransport();
    if (!transporter) {
      return NextResponse.json(
        {error: "Email transport is not configured."},
        {status: 500},
      );
    }

    const origin = getRequestOrigin(request);
    const siteHost = getOriginHost(origin);

    try {
      await transporter.sendMail({
        from: getDefaultSender(),
        to: admin.email,
        subject: `Your ${siteHost} admin sign-in code`,
        text: `Your admin sign-in code is ${challenge.code}.\n\nThis code expires in 10 minutes. If you did not request it, change your password immediately.`,
        html: await renderAdminCodeEmail({
          code: challenge.code,
          origin,
          siteHost,
        }),
      });
    } catch (error) {
      console.error("Admin auth email error", error);
      return NextResponse.json(
        {error: "Unable to send verification email."},
        {status: 500},
      );
    }
  }

  return NextResponse.json({
    challengeId: challenge.challengeId,
    method: challenge.method,
    methods,
    expiresAt: challenge.expiresAt.toISOString(),
  });
}
