import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {
  AiSettingsError,
  getAiSettings,
  saveAiSettings,
} from "../../../lib/aiSettings";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof AiSettingsError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin AI settings API error", error);
  return NextResponse.json(
    {error: "Unable to process AI settings."},
    {status: 500}
  );
}

export async function GET() {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const settings = await getAiSettings();
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
    const settings = await saveAiSettings(body, user);
    return NextResponse.json({settings});
  } catch (error) {
    return errorResponse(error);
  }
}
