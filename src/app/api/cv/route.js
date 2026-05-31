import {NextResponse} from "next/server";

import {getCvDownloads, getDefaultCvDownloads} from "../../lib/cvFiles";

export const runtime = "nodejs";

function publicDownloads(downloads) {
  return Object.fromEntries(
    Object.entries(downloads).map(([language, asset]) => [
      language,
      {
        type: asset.type,
        language: asset.language,
        mimeType: asset.mimeType,
        fileName: asset.fileName,
        size: asset.size,
        updatedAt: asset.updatedAt,
        source: asset.source,
        requiresLead: true,
      },
    ])
  );
}

export async function GET() {
  try {
    const downloads = await getCvDownloads();
    return NextResponse.json({downloads: publicDownloads(downloads)});
  } catch (error) {
    console.warn("Unable to load stored CV downloads", error);
    return NextResponse.json({downloads: publicDownloads(getDefaultCvDownloads())});
  }
}
