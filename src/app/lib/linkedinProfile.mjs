const MESSAGE = "Enter a LinkedIn personal profile URL, such as linkedin.com/in/name.";

export function normalizeLinkedinProfileUrl(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string") throw new Error(MESSAGE);
  const text = value.trim();
  if (!text) return "";
  if (text.length > 2000 || /\s/.test(text)) throw new Error(MESSAGE);
  let url;
  try { url = new URL(/^(?:[a-z0-9-]+\.)*linkedin\.com\//i.test(text) ? `https://${text}` : text); }
  catch { throw new Error(MESSAGE); }
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password || url.port ||
    !(url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) ||
    !/^\/in\/[^/]+\/?$/.test(url.pathname)) throw new Error(MESSAGE);
  let slug;
  try { slug = decodeURIComponent(url.pathname.split("/")[2]); } catch { throw new Error(MESSAGE); }
  if (!/^[\p{L}\p{N}_-]+$/u.test(slug)) throw new Error(MESSAGE);
  return `https://www.linkedin.com/in/${encodeURIComponent(slug)}`;
}

export function linkedinProfileState(value) {
  try { return {url: normalizeLinkedinProfileUrl(value), error: ""}; }
  catch (error) { return {url: "", error: error.message}; }
}
