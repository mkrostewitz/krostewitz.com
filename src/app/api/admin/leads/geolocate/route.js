import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {geolocateStoredLeadIps, LeadValidationError} from "../../../../lib/leads";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LeadValidationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin lead geolocation API error", error);
  return NextResponse.json({error: "Unable to geolocate leads."}, {status: 500});
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const result = await geolocateStoredLeadIps(body, user);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
