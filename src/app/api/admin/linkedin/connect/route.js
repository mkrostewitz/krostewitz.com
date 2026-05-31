import {NextResponse} from "next/server";

import {getCurrentAdminUser} from "../../../../lib/adminAuth";
import {
  createLinkedInAuthorizationRequest,
  getCanonicalLinkedInStartUrl,
  LINKEDIN_PUBLISHING_SCOPES,
  setLinkedInStateCookie,
} from "../../../../lib/linkedinAuth";

export const runtime = "nodejs";

function redirectToPosts(request, params = {}) {
  const url = new URL("/admin/posts", request.url);

  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  return NextResponse.redirect(url);
}

export async function GET(request) {
  const canonicalStartUrl = getCanonicalLinkedInStartUrl(
    request,
    "/api/admin/linkedin/connect",
  );

  if (canonicalStartUrl) {
    return NextResponse.redirect(canonicalStartUrl);
  }

  const user = await getCurrentAdminUser();

  if (!user) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  let authorization;

  try {
    authorization = createLinkedInAuthorizationRequest(request, {
      intent: "publishing_connection",
      returnTo: "/admin/posts",
      scopes: LINKEDIN_PUBLISHING_SCOPES,
    });
  } catch (error) {
    console.error("LinkedIn publishing connect error", error);
    return redirectToPosts(request, {linkedin_error: "not_configured"});
  }

  const response = NextResponse.redirect(authorization.authorizationUrl);
  setLinkedInStateCookie(response, authorization.state);

  return response;
}
