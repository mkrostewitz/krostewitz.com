import {NextResponse} from "next/server";

import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../lib/adminAuth";
import {createAdminLead, getAdminLeads, LeadValidationError} from "../../../lib/leads";

import {OutreachValidationError} from "../../../lib/leadOutreach.mjs";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LeadValidationError || error instanceof OutreachValidationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin leads API error", error);
  return NextResponse.json({error: "Unable to process leads."}, {status: 500});
}

export async function GET(request) {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {searchParams} = new URL(request.url);
    const leads = await getAdminLeads({
      status: searchParams.get("status") || "",
      sourceType: searchParams.get("sourceType") || "",
      limit: searchParams.get("limit") || "",
      offset: searchParams.get("offset") || "",
    });

    return NextResponse.json({leads});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new OutreachValidationError("Enter valid lead details.");
    const lead = await createAdminLead(body, user);
    return NextResponse.json({lead}, {status: 201});
  } catch (error) {
    return errorResponse(error);
  }
}
