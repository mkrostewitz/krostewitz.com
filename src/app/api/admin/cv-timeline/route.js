import {NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../lib/adminAuth";
import {getCvTimeline, saveCvTimeline} from "../../../lib/cvTimeline";
import {TimelineError} from "../../../lib/cvTimelineData.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error) {
  if (error instanceof TimelineError) return NextResponse.json({error: error.message}, {status: error.status});
  console.error("CV timeline API error", error);
  return NextResponse.json({error: "Unable to process CV timeline."}, {status: 500});
}

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    return NextResponse.json(await getCvTimeline(), {headers: {"Cache-Control": "no-store"}});
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    return NextResponse.json(await saveCvTimeline(body, user));
  } catch (error) { return errorResponse(error); }
}
