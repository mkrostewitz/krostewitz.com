import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {createPost, getAdminPosts, PostValidationError} from "../../../lib/posts";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof PostValidationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin posts API error", error);
  return NextResponse.json({error: "Unable to process post."}, {status: 500});
}

export async function GET(request) {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  const {searchParams} = new URL(request.url);
  const posts = await getAdminPosts({
    status: searchParams.get("status") || "",
  });

  return NextResponse.json({posts});
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const post = await createPost(body, user);

    return NextResponse.json({post}, {status: 201});
  } catch (error) {
    return errorResponse(error);
  }
}
