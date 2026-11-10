import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {
  UploadError,
  uploadPostAsset,
  uploadPostDocument,
  uploadSiteAsset,
  uploadAboutPhoto,
  uploadLeadPhoto,
  uploadTimelineDocument,
} from "../../../lib/storage";

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
    const purpose = String(formData.get("purpose") || "");
    const asset =
      purpose === "post-document" ? await uploadPostDocument(file, user) : purpose === "about-photo" ? await uploadAboutPhoto(file, user) : purpose === "timeline-document" ? await uploadTimelineDocument(file, user) : purpose === "lead-photo" ? await uploadLeadPhoto(file, user) : purpose === "site-branding"
        ? await uploadSiteAsset(file, formData.get("kind"), user)
        : await uploadPostAsset(file, user);

    return NextResponse.json({asset}, {status: 201});
  } catch (error) {
    if (error instanceof UploadError) {
      return NextResponse.json({error: error.message}, {status: error.status});
    }

    console.error("Upload API error", error);
    return NextResponse.json({error: "Unable to upload file."}, {status: 500});
  }
}
