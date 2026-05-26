import {NextResponse} from "next/server";

import {
  clearSessionCookie,
  isSameOriginRequest,
  revokeAdminSessionFromCookie,
} from "../../../../lib/adminAuth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  await revokeAdminSessionFromCookie();
  return clearSessionCookie();
}
