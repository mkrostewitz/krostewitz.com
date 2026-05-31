import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {LeadValidationError, updateAdminLead} from "../../../../lib/leads";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LeadValidationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin lead API error", error);
  return NextResponse.json({error: "Unable to process lead."}, {status: 500});
}

export async function PATCH(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {leadId} = await context.params;
    const body = await request.json().catch(() => ({}));
    const lead = await updateAdminLead(leadId, body, user);

    return NextResponse.json({lead});
  } catch (error) {
    return errorResponse(error);
  }
}
