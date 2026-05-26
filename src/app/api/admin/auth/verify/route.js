import {NextResponse} from "next/server";

import {
  createAdminSession,
  isSameOriginRequest,
  setSessionCookie,
  verifyAuthChallenge,
} from "../../../../lib/adminAuth";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const {challengeId, code} = await request.json().catch(() => ({}));
  const user = await verifyAuthChallenge(challengeId, code);

  if (!user) {
    return NextResponse.json(
      {error: "Invalid or expired verification code."},
      {status: 401}
    );
  }

  const session = await createAdminSession(user, {secondFactor: user.method});
  const response = NextResponse.json({
    ok: true,
    user: {
      email: user.email,
      name: user.name,
    },
  });

  setSessionCookie(response, session.token);

  return response;
}
