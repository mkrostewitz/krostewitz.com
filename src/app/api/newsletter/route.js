import {NextResponse} from "next/server";
import {isSameOriginRequest} from "../../lib/adminAuth";
import {getClientIp} from "../../lib/requestGeo";
import {subscribeNewsletter} from "../../lib/newsletter";
import {getRequestOrigin} from "../../lib/requestOrigin";

export const runtime = "nodejs";
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: "invalid"}, {status: 403});
  try {
    const text = await request.text();
    if (text.length > 4096) return NextResponse.json({error: "invalid"}, {status: 413});
    let input;
    try { input = JSON.parse(text); } catch { return NextResponse.json({error: "invalid"}, {status: 400}); }
    if (!input || typeof input !== "object") return NextResponse.json({error: "invalid"}, {status: 400});
    const ip = getClientIp(request) || "unknown";
    const result = await subscribeNewsletter(input, ip, getRequestOrigin(request));
    return NextResponse.json(result.error ? {error: result.error} : {ok: true}, {status: result.status, headers: {"Cache-Control": "no-store"}});
  } catch {
    return NextResponse.json({error: "unavailable"}, {status: 503});
  }
}
