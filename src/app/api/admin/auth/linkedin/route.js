import {NextResponse} from "next/server";

import {
  createLinkedInAuthorizationRequest,
  getCanonicalLinkedInStartUrl,
  setLinkedInStateCookie,
} from "../../../../lib/linkedinAuth";

export const runtime = "nodejs";

function redirectToLogin(request, error) {
  const url = new URL("/admin/login", request.url);
  url.searchParams.set("linkedin_error", error);
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const canonicalStartUrl = getCanonicalLinkedInStartUrl(
    request,
    "/api/admin/auth/linkedin",
  );

  if (canonicalStartUrl) {
    return NextResponse.redirect(canonicalStartUrl);
  }

  let authorization;

  try {
    authorization = createLinkedInAuthorizationRequest(request);
  } catch (error) {
    console.error("LinkedIn auth start error", error);
    return redirectToLogin(request, "not_configured");
  }

  const response = NextResponse.redirect(authorization.authorizationUrl);
  setLinkedInStateCookie(response, authorization.state);

  return response;
}
