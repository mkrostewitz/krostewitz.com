import {NextResponse} from "next/server";

import {getPublishedPosts} from "../../lib/posts";

export const runtime = "nodejs";

export async function GET() {
  try {
    const posts = await getPublishedPosts();
    return NextResponse.json({posts});
  } catch (error) {
    console.error("Public posts API error", error);
    return NextResponse.json({posts: []}, {status: 200});
  }
}
