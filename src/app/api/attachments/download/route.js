import {NextResponse} from "next/server";
import {getLeadByDownloadToken, getLeadByDownloadCookie, recordLeadDownload} from "../../../lib/leads";
import {resolveDownloadAttachment} from "../../../lib/attachmentDownloads";

export const runtime = "nodejs";

export async function GET(request) {
  const {searchParams} = new URL(request.url);
  const token = searchParams.get("token");
  const lead = token ? await getLeadByDownloadToken(token, "attachment_download") : await getLeadByDownloadCookie(request);
  if (!lead) return NextResponse.json({error: "Download access expired."}, {status: 403});
  const context = token ? lead.source.context : {
    timelineEntryId: searchParams.get("timelineEntryId"),
    documentId: searchParams.get("documentId"),
    postSlug: searchParams.get("postSlug"),
    attachmentKey: searchParams.get("attachmentKey"),
  };
  const asset = await resolveDownloadAttachment(context);
  if (!asset) return NextResponse.json({error: "Attachment is not available."}, {status: 404});
  const response = await fetch(asset.url, {cache: "no-store"});
  if (!response.ok) return NextResponse.json({error: "Attachment could not be loaded."}, {status: 502});
  await recordLeadDownload(lead._id, {...context, fileName: asset.fileName});
  const fileName = asset.fileName.replace(/[^a-zA-Z0-9._ -]/g, "_");
  return new NextResponse(response.body, {headers: {
    "Content-Type": asset.mimeType,
    "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(asset.fileName)}`,
    "Cache-Control": "private, no-store",
  }});
}
