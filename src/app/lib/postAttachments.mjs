export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
};
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_TYPES).map(ext => `.${ext}`).join(",");

export function documentMimeType(fileName) {
  const extension = String(fileName || "").split(".").pop().toLowerCase();
  return Object.hasOwn(DOCUMENT_TYPES, extension) ? DOCUMENT_TYPES[extension] : null;
}

export function normalizeAttachments(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Attachments must be a list.");
  const seen = new Set();
  return value.map(item => {
    if (!item || typeof item !== "object") throw new Error("Invalid attachment.");
    const fileName = String(item.fileName || "").trim().slice(0, 200);
    const mimeType = documentMimeType(fileName);
    let url;
    try { url = new URL(item.url); } catch { throw new Error("Invalid attachment URL."); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid attachment URL.");
    const size = Number(item.size);
    if (!mimeType || !Number.isInteger(size) || size <= 0 || size > MAX_DOCUMENT_BYTES) throw new Error("Attachments must be supported documents up to 10 MB.");
    return {type: "document", fileName, mimeType, size, url: url.href, key: String(item.key || "")};
  }).filter(item => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}

export function formatDocumentSize(size) {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(size / 1024))} KB`;
}
