import {NextResponse} from "next/server";

import {
  createAdminSession,
  getCurrentAdminUser,
  getConfiguredAdmin,
  setSessionCookie,
} from "../../../../../lib/adminAuth";
import {saveLinkedInConnection} from "../../../../../lib/linkedinIntegration";
import {
  assertLinkedInSignInEnabled,
  clearLinkedInStateCookie,
  exchangeLinkedInAuthorizationCode,
  getLinkedInStateFromRequest,
  getLinkedInUserInfo,
} from "../../../../../lib/linkedinAuth";

export const runtime = "nodejs";

function redirectToLogin(request, error) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("linkedin_error", error);

  const response = NextResponse.redirect(url);
  clearLinkedInStateCookie(response);
  return response;
}

function redirectToAdmin(request, sessionToken) {
  return completeWithClientRedirect(request, "/admin/posts", {}, sessionToken);
}

function redirectToPosts(request, params = {}) {
  const url = new URL("/admin/posts", request.url);

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  return completeWithClientRedirect(request, url.pathname, params);
}

function completeWithClientRedirect(
  request,
  pathname,
  params = {},
  sessionToken = "",
) {
  const url = new URL(pathname, request.url);

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const destination = `${url.pathname}${url.search}`;
  const response = new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="robots" content="noindex" />
    <title>LinkedIn authorization complete</title>
  </head>
  <body>
    <p>Completing LinkedIn authorization...</p>
    <script>window.location.replace(${JSON.stringify(destination)});</script>
    <noscript><a href="${destination}">Continue</a></noscript>
  </body>
</html>`,
    {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );

  clearLinkedInStateCookie(response);
  if (sessionToken) {
    setSessionCookie(response, sessionToken);
  }
  return response;
}

export async function GET(request) {
  const callbackUrl = new URL(request.url);
  const providerError = callbackUrl.searchParams.get("error");

  if (providerError) {
    console.warn(
      "LinkedIn sign-in was not completed:",
      providerError,
      callbackUrl.searchParams.get("error_description") || "",
    );
    return redirectToLogin(request, "cancelled");
  }

  const code = callbackUrl.searchParams.get("code");
  const state = callbackUrl.searchParams.get("state");
  const stateRecord = getLinkedInStateFromRequest(request);

  if (!code || !state || !stateRecord || stateRecord.state !== state) {
    return redirectToLogin(request, "state");
  }

  try {
    assertLinkedInSignInEnabled();

    const tokens = await exchangeLinkedInAuthorizationCode({
      code,
      redirectUri: stateRecord.redirectUri,
    });
    const profile = await getLinkedInUserInfo(tokens.access_token);

    if (!profile.email || profile.emailVerified === false) {
      return redirectToLogin(request, "email");
    }

    if (stateRecord.intent === "publishing_connection") {
      const currentUser = await getCurrentAdminUser();

      if (!currentUser) {
        return redirectToLogin(request, "unauthorized");
      }

      if (currentUser.email !== profile.email) {
        return redirectToPosts(request, {linkedin_error: "account_mismatch"});
      }

      // LinkedIn publishing is connected only to the current admin account.
      await saveLinkedInConnection({
        profile,
        scopes: stateRecord.scopes || [],
        tokens,
        user: currentUser,
      });

      return redirectToPosts(request, {linkedin: "connected"});
    }

    // LinkedIn sign-in is account matching only. Do not create users here.
    const admin = await getConfiguredAdmin(profile.email);
    if (!admin || admin.email !== profile.email) {
      return redirectToLogin(request, "unauthorized");
    }

    const session = await createAdminSession(
      {email: admin.email, name: admin.name},
      {secondFactor: "linkedin"},
    );

    return redirectToAdmin(request, session.token);
  } catch (error) {
    console.error("LinkedIn auth callback error", error);
    return redirectToLogin(request, "failed");
  }
}
