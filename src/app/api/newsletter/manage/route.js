import {NextResponse} from "next/server";
import {isSameOriginRequest} from "../../../lib/adminAuth";
import {manageNewsletter} from "../../../lib/newsletter";

export const runtime = "nodejs";
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: "invalid"}, {status: 403});
  try {
    const input = await request.json();
    const ok = await manageNewsletter(input?.action, input?.token);
    return NextResponse.json({ok}, {status: ok ? 200 : 400, headers: {"Cache-Control": "no-store"}});
  } catch {
    return NextResponse.json({error: "unavailable"}, {status: 503});
  }
}
