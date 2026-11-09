export const CV_CHUNK_BYTES = 1024 * 1024;
export const CV_MAX_BYTES = 10 * 1024 * 1024;
export function decodeCvChunk(data, index, size) {
  const expected = Math.min(CV_CHUNK_BYTES, size - index * CV_CHUNK_BYTES);
  if (!Number.isInteger(index) || index < 0 || expected <= 0 || typeof data !== 'string' || data.length > Math.ceil(CV_CHUNK_BYTES / 3) * 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) throw new Error('Invalid upload chunk.');
  const buffer = Buffer.from(data, 'base64');
  if (buffer.length !== expected || buffer.toString('base64') !== data) throw new Error('Invalid upload chunk size.');
  return buffer;
}
