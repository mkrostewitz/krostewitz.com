import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../../lib/adminAuth";
import {
  LinkedInIntegrationError,
  publishPostToLinkedIn,
} from "../../../../../lib/linkedinIntegration";
import {getRequestOrigin} from "../../../../../lib/requestOrigin";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LinkedInIntegrationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
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
    const result = await publishPostToLinkedIn({
      postId,
      origin: getRequestOrigin(request),
      user,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
