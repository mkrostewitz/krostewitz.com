import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {
  CvFileError,
  getCvDownloads,
  normalizeCvLanguage,
  saveCvDownload,
} from "../../../lib/cvFiles";
import {UploadError, uploadCvAsset} from "../../../lib/storage";

export const runtime = "nodejs";

function errorResponse(error) {
  if (error instanceof CvFileError || error instanceof UploadError) {
    return NextResponse.json({error: error.message}, {status: error.status});
  }

  console.error("Admin CV API error", error);
  return NextResponse.json({error: "Unable to process CV file."}, {status: 500});
}

export async function GET() {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const downloads = await getCvDownloads();
    return NextResponse.json({downloads});
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const formData = await request.formData();
    const language = normalizeCvLanguage(formData.get("language"));
    const file = formData.get("file");
    const asset = await uploadCvAsset(file, language, user);
    const downloads = await saveCvDownload(language, asset, user);

    return NextResponse.json({asset: downloads[language], downloads}, {status: 201});
  } catch (error) {
    return errorResponse(error);
  }
}
