import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {
  disconnectLinkedInConnection,
  getLinkedInConnection,
  LinkedInIntegrationError,
} from "../../../lib/linkedinIntegration";
import {isLinkedInSignInAvailable} from "../../../lib/linkedinAuth";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof LinkedInIntegrationError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin LinkedIn API error", error);
  return NextResponse.json(
    {error: "Unable to process LinkedIn integration."},
    {status: 500},
  );
}

export async function GET() {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const connection = await getLinkedInConnection();
    return NextResponse.json({
      integration: {
        available: isLinkedInSignInAvailable(),
        ...connection,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const connection = await disconnectLinkedInConnection(user);
    return NextResponse.json({
      integration: {
        available: isLinkedInSignInAvailable(),
        ...connection,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
