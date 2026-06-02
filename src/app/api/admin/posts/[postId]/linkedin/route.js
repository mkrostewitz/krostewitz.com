import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../../lib/adminAuth";
import {
  cancelScheduledPostToLinkedIn,
  LinkedInIntegrationError,
  publishPostToLinkedIn,
  schedulePostToLinkedIn,
  updateScheduledPostToLinkedIn,
} from "../../../../../lib/linkedinIntegration";
import {getRequestOrigin} from "../../../../../lib/requestOrigin";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LinkedInIntegrationError) {
    return NextResponse.json(
      {error: error.message, post: error.post || null},
      {status: error.status},
    );
  }

  console.error("Admin LinkedIn post share error", error);
  return NextResponse.json(
    {error: "Unable to share post to LinkedIn."},
    {status: 500},
  );
}

export async function POST(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {postId} = await context.params;
    const body = await request.json().catch(() => ({}));
    const payload = {
      commentary: body.commentary,
      includeImage: body.includeImage !== false,
      language: body.language,
      postId,
      origin: getRequestOrigin(request),
      target: body.target || "personal_profile",
      user,
    };
    const result = body.scheduledAt
      ? body.scheduledJobId
        ? await updateScheduledPostToLinkedIn({
            ...payload,
            jobId: body.scheduledJobId,
            scheduledAt: body.scheduledAt,
            scheduledTimeZone: body.scheduledTimeZone,
          })
        : await schedulePostToLinkedIn({
            ...payload,
            scheduledAt: body.scheduledAt,
            scheduledTimeZone: body.scheduledTimeZone,
          })
      : await publishPostToLinkedIn(payload);

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {postId} = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await cancelScheduledPostToLinkedIn({
      jobId: body.jobId,
      postId,
      user,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
