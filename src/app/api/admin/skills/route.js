import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {getSkills, saveSkills, SkillsCollectionError} from "../../../lib/skills";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof SkillsCollectionError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin skills API error", error);
  return NextResponse.json(
    {error: "Unable to process skills."},
    {status: 500}
  );
}

function getSkillsPayload(body) {
  if (Array.isArray(body)) return body;

  return body?.skills;
}

export async function GET() {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const skills = await getSkills();
    return NextResponse.json({skills});
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
    const skills = await saveSkills(getSkillsPayload(body), user);
    return NextResponse.json({skills});
  } catch (error) {
    return errorResponse(error);
  }
}
