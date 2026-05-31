import {NextResponse} from "next/server";

import {getCurrentAdminUser, unauthorizedResponse} from "../../../lib/adminAuth";
import {getAdminLeads, LeadValidationError} from "../../../lib/leads";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LeadValidationError) {
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
    });

    return NextResponse.json({leads});
  } catch (error) {
    return errorResponse(error);
  }
}
