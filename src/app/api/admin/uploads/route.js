import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {UploadError, uploadPostAsset} from "../../../lib/storage";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const asset = await uploadPostAsset(file, user);

    return NextResponse.json({asset}, {status: 201});
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({error: error.message}, {status: error.status});
    }

    console.error("Upload API error", error);
    return NextResponse.json({error: "Unable to upload file."}, {status: 500});
  }
}
