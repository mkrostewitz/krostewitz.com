import {NextResponse} from "next/server";

import {getCurrentAdminUser, unauthorizedResponse} from "../../../../lib/adminAuth";
import {
  isLinkedInSchedulerConfigured,
  LinkedInIntegrationError,
  publishDueLinkedInShares,
} from "../../../../lib/linkedinIntegration";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LinkedInIntegrationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin LinkedIn scheduled share error", error);
  return NextResponse.json(
    {error: "Unable to process scheduled LinkedIn shares."},
    {status: 500},
  );
}

function hasSchedulerSecret(request) {
  const expectedSecret = String(
    process.env.LINKEDIN_SCHEDULER_SECRET || "",
  ).trim();

  if (!expectedSecret) return false;

  const authorization = request.headers.get("authorization") || "";
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const headerSecret = request.headers.get("x-linkedin-scheduler-secret") || "";

  return bearer === expectedSecret || headerSecret === expectedSecret;
}

export async function POST(request) {
  const user = await getCurrentAdminUser();
  const authorizedBySecret = hasSchedulerSecret(request);

  if (!user && !authorizedBySecret) {
    return unauthorizedResponse();
  }

  if (!isLinkedInSchedulerConfigured()) {
    return NextResponse.json({
      checked: 0,
      disabled: true,
      results: [],
    });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const result = await publishDueLinkedInShares({
      limit: body.limit || 5,
      source: user ? "manual" : "netlify",
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
