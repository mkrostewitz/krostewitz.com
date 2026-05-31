import {NextResponse} from "next/server";

import {getCvDownloads} from "../../../lib/cvFiles";
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
  const lead = await getLeadByDownloadToken(token);

  if (!lead) {
    return NextResponse.json({error: "CV download access expired."}, {status: 403});
  }

  const language = lead.source?.context?.cvLanguage || "en";
  const downloads = await getCvDownloads();
  const asset = downloads[language] || downloads.en;

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
