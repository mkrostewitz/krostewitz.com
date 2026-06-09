import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {getMailDeliveryStatus, saveMailSettings} from "../../../lib/mail";

export const runtime = "nodejs";

function errorResponse(error) {
  console.error("Admin mail settings API error", error);
  return NextResponse.json(
    {error: error?.message || "Unable to process mail settings."},
    {status: 500}
  );
}

export async function GET() {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const settings = await getMailDeliveryStatus();
    return NextResponse.json({settings});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const settings = await saveMailSettings(body.mail || body, user);
    return NextResponse.json({settings});
  } catch (error) {
    return errorResponse(error);
  }
}
