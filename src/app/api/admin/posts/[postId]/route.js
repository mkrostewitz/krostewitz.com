import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {
  getAdminPostById,
  PostValidationError,
  updatePost,
} from "../../../../lib/posts";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof PostValidationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin post API error", error);
  return NextResponse.json({error: "Unable to process post."}, {status: 500});
}

export async function GET(request, context) {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {postId} = await context.params;
    const post = await getAdminPostById(postId);

    if (!post) {
      return NextResponse.json({error: "Post not found."}, {status: 404});
    }

    return NextResponse.json({post});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {postId} = await context.params;
    const body = await request.json().catch(() => ({}));
    const post = await updatePost(postId, body, user);

    return NextResponse.json({post});
  } catch (error) {
    return errorResponse(error);
  }
}
