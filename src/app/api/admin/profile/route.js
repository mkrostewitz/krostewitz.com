import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {
  getSiteProfile,
  saveSiteProfile,
  SiteProfileError,
} from "../../../lib/siteProfile";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof SiteProfileError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin profile API error", error);
  return NextResponse.json(
    {error: "Unable to process profile settings."},
    {status: 500}
  );
}

export async function GET() {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const profile = await getSiteProfile();
    return NextResponse.json({profile});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const profile = await saveSiteProfile(body, user);
    return NextResponse.json({profile});
  } catch (error) {
    return errorResponse(error);
  }
}
