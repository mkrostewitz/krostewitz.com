import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {LeadValidationError, updateAdminLead, deleteAdminLead} from "../../../../lib/leads";

import {OutreachValidationError} from "../../../../lib/leadOutreach.mjs";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LeadValidationError || error instanceof OutreachValidationError) {
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
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new OutreachValidationError("Enter valid lead details.");
    const lead = await updateAdminLead(leadId, body, user);

    return NextResponse.json({lead});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {leadId} = await context.params;
    await deleteAdminLead(leadId);
    return NextResponse.json({deleted: true});
  } catch (error) {
    return errorResponse(error);
  }
}
