import {NextResponse} from "next/server";

import {CvFileError, getCvDownloads, normalizeCvLanguage} from "../../../lib/cvFiles";
import {getLeadByDownloadToken, recordLeadDownload} from "../../../lib/leads";

export const runtime = "nodejs";

function safeFileName(value) {
  return String(value || "Mathias_Krostewitz_CV.pdf")
    .replace(/[/\\?%*:|"<>]/g, "_")
    .slice(0, 180);
}

function downloadHeaders(asset) {
  const fileName = safeFileName(asset.fileName);

  return {
    "Content-Type": asset.mimeType || "application/pdf",
    "Content-Disposition": `attachment; filename="${fileName}"`,
    "Cache-Control": "private, no-store",
  };
}

export async function GET(request) {
  const {searchParams} = new URL(request.url);
  const token = searchParams.get("token") || "";
  const requestedLanguage = searchParams.get("language");
  const lead = await getLeadByDownloadToken(token);

  if (!lead) {
    return NextResponse.json({error: "CV download access expired."}, {status: 403});
  }

  let language;
  try {
    language = normalizeCvLanguage(
      requestedLanguage || lead.source?.context?.cvLanguage || "en"
    );
  } catch (error) {
    if (error instanceof CvFileError) {
      return NextResponse.json({error: error.message}, {status: error.status});
    }

    throw error;
  }

  const downloads = await getCvDownloads();
  const preferredAsset = downloads[language];
  const fallbackAsset = !requestedLanguage && language !== "en" ? downloads.en : null;
  const asset = preferredAsset?.url ? preferredAsset : fallbackAsset;

  if (!asset?.url) {
    return NextResponse.json({error: "CV file is not available."}, {status: 404});
  }

  const headers = downloadHeaders(asset);

  const response = await fetch(asset.url, {cache: "no-store"});

  if (!response.ok) {
    return NextResponse.json({error: "CV file could not be loaded."}, {status: 502});
  }

  await recordLeadDownload(lead._id);
  return new NextResponse(response.body, {headers});
}
