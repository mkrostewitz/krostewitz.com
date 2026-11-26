import {NextResponse} from "next/server";
import {getLeadByDownloadCookie} from "../../lib/leads";

export const dynamic = "force-dynamic";

export async function GET(request) {
  const lead = await getLeadByDownloadCookie(request);
  return NextResponse.json({verified: Boolean(lead)}, {
    headers: {"Cache-Control": "private, no-store"},
  });
}
