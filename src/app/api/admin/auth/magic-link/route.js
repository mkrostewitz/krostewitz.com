import {NextResponse} from "next/server";

import {
  createAdminSession,
  createMagicLinkChallenge,
  getConfiguredAdmin,
  hashPassword,
  isSameOriginRequest,
  setSessionCookie,
  verifyMagicLinkChallenge,
} from "../../../../lib/adminAuth";
import {renderAdminMagicLinkEmail} from "../../../../lib/emailTemplates";
import {getAppleMailTransport, getDefaultSender} from "../../../../lib/mail";
import {getDb} from "../../../../lib/mongo";
import {getOriginHost, getRequestOrigin} from "../../../../lib/requestOrigin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_PASSWORD_LENGTH = 12;
const USERS_COLLECTION = "users";
const COMPLETE_SIGN_IN_ACTION = "complete_sign_in";

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

function createPasswordResetLink(request, challenge) {
  const url = new URL("/admin/reset-password", getRequestOrigin(request));
  url.searchParams.set("challenge", challenge.challengeId);
  url.searchParams.set("token", challenge.token);
  return url.toString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function jsonForScript(value) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function noStore(response) {
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
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

async function readRequestBody(request) {
  const contentType = request.headers.get("content-type") || "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  }

  return request.json().catch(() => ({}));
}

function wantsHtmlResponse(request) {
  return String(request.headers.get("accept") || "").includes("text/html");
}

function redirectToLogin(request) {
  return noStore(NextResponse.redirect(new URL("/admin/login", request.url)));
}

function createMagicLinkCompletionPage(request, challengeId, token, redirectPath) {
  const actionPath = "/api/admin/auth/magic-link";
  const payload = {
    action: COMPLETE_SIGN_IN_ACTION,
    challenge: challengeId,
    token,
  };

  return noStore(
    new NextResponse(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>Completing admin sign in</title>
    <style>
      :root { color-scheme: light dark; }
      * { box-sizing: border-box; }
      body {
        min-height: 100vh;
        display: grid;
        place-items: center;
        margin: 0;
        padding: 24px;
        background: #0f1117;
        color: #f4f4f5;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        width: min(100%, 420px);
        display: grid;
        gap: 16px;
        border: 1px solid rgba(244, 244, 245, 0.16);
        border-radius: 8px;
        padding: 28px;
        background: #171a22;
      }
      h1 { margin: 0; font-size: 1.45rem; }
      p { margin: 0; color: #d8dde5; line-height: 1.55; }
      button, a {
        min-height: 42px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid #f4f4f5;
        border-radius: 6px;
        padding: 10px 14px;
        background: #f4f4f5;
        color: #171a22;
        font: inherit;
        font-weight: 800;
        text-decoration: none;
        cursor: pointer;
      }
      form { display: none; }
      [data-state="error"] form { display: grid; gap: 10px; }
      .error { display: none; color: #ffb4ab; }
      [data-state="error"] .error { display: block; }
    </style>
  </head>
  <body>
    <main>
      <h1>Completing sign in</h1>
      <p>Opening the admin area...</p>
      <p class="error">Automatic sign-in did not complete. Use the button below to continue.</p>
      <form method="post" action="${escapeHtml(actionPath)}">
        <input type="hidden" name="action" value="${escapeHtml(COMPLETE_SIGN_IN_ACTION)}" />
        <input type="hidden" name="challenge" value="${escapeHtml(challengeId)}" />
        <input type="hidden" name="token" value="${escapeHtml(token)}" />
        <button type="submit">Continue to admin</button>
      </form>
      <noscript>
        <p>JavaScript is disabled. Use the button below to continue.</p>
        <form method="post" action="${escapeHtml(actionPath)}" style="display:grid;gap:10px;">
          <input type="hidden" name="action" value="${escapeHtml(COMPLETE_SIGN_IN_ACTION)}" />
          <input type="hidden" name="challenge" value="${escapeHtml(challengeId)}" />
          <input type="hidden" name="token" value="${escapeHtml(token)}" />
          <button type="submit">Continue to admin</button>
        </form>
      </noscript>
    </main>
    <script>
      (async () => {
        try {
          const response = await fetch(${jsonForScript(actionPath)}, {
            method: "POST",
            credentials: "same-origin",
            headers: {"Content-Type": "application/json"},
            body: ${jsonForScript(JSON.stringify(payload))},
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || !data.ok) throw new Error(data.error || "Unable to complete sign-in.");
          window.location.replace(data.redirectPath || ${jsonForScript(redirectPath)});
        } catch (error) {
          document.documentElement.dataset.state = "error";
        }
      })();
    </script>
  </body>
</html>`,
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
        },
      },
    ),
  );
}

async function completeMagicLinkSignIn(request, challenge, token, htmlResponse) {
  const user = await verifyMagicLinkChallenge(challenge, token, {
    intent: "sign_in",
  });

  if (!user) {
    if (htmlResponse) return redirectToLogin(request);
    return NextResponse.json(
      {error: "Magic link is invalid or expired."},
      {status: 401},
    );
  }

  const session = await createAdminSession(user, {
    secondFactor: user.method,
  });
  const redirectPath = normalizeRedirectPath(user.redirectPath);

  if (htmlResponse) {
    const response = NextResponse.redirect(new URL(redirectPath, request.url), {
      status: 303,
    });
    setSessionCookie(response, session.token);
    return noStore(response);
  }

  const response = NextResponse.json({ok: true, redirectPath});
  setSessionCookie(response, session.token);
  return noStore(response);
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const {
    action,
    challenge: completionChallenge,
    token: completionToken,
    email,
    intent = "sign_in",
    redirectPath,
  } = await readRequestBody(request);

  if (action === COMPLETE_SIGN_IN_ACTION) {
    return completeMagicLinkSignIn(
      request,
      completionChallenge,
      completionToken,
      wantsHtmlResponse(request),
    );
  }

  const normalizedIntent =
    intent === "password_reset" ? "password_reset" : "sign_in";
  const admin = await getConfiguredAdmin(email);
  if (!admin || normalizeEmail(email) !== admin.email) {
    return NextResponse.json({ok: true});
  }

  const transporter = await getAppleMailTransport();
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
          ? "/admin/reset-password"
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
  const isPasswordReset = normalizedIntent === "password_reset";
  const link = isPasswordReset
    ? createPasswordResetLink(request, challenge)
    : createMagicLink(request, challenge);

  try {
    await transporter.sendMail({
      from: await getDefaultSender(),
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
  const passwordResetUser = await verifyMagicLinkChallenge(challengeId, token, {
    consume: false,
    intent: "password_reset",
  });

  if (passwordResetUser) {
    const resetUrl = new URL("/admin/reset-password", request.url);
    resetUrl.searchParams.set("challenge", challengeId);
    resetUrl.searchParams.set("token", token);
    return noStore(NextResponse.redirect(resetUrl));
  }

  const user = await verifyMagicLinkChallenge(challengeId, token, {
    consume: false,
    intent: "sign_in",
  });

  if (!user) {
    return redirectToLogin(request);
  }

  return createMagicLinkCompletionPage(
    request,
    challengeId,
    token,
    normalizeRedirectPath(user.redirectPath),
  );
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const {challenge, token, password} = await request.json().catch(() => ({}));

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`},
      {status: 400},
    );
  }

  const user = await verifyMagicLinkChallenge(challenge, token, {
    intent: "password_reset",
  });

  if (!user) {
    return NextResponse.json(
      {error: "Password reset link is invalid or expired."},
      {status: 400},
    );
  }

  const result = await updateUserPassword(
    user.email,
    await hashPassword(password),
  );

  if (result.matchedCount !== 1) {
    return NextResponse.json(
      {error: "Admin user could not be updated."},
      {status: 404},
    );
  }

  return NextResponse.json({ok: true});
}
