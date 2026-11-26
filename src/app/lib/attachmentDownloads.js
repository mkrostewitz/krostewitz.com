import "server-only";
import {getCvTimeline} from "./cvTimeline";
import {getPublishedPostBySlug} from "./posts";

export async function resolveDownloadAttachment(context = {}) {
  if (context.timelineEntryId) {
    const {entries} = await getCvTimeline();
    const entry = entries.find(item => item.id === context.timelineEntryId);
    const document = entry?.documents?.find(item => item.id === context.documentId);
    return document ? {...document, mimeType: "application/pdf"} : null;
  }
  if (!context.postSlug || !context.attachmentKey) return null;
  const post = await getPublishedPostBySlug(context.postSlug);
  return post?.attachments?.find(item => (item.key || item.fileName) === context.attachmentKey) || null;
}
