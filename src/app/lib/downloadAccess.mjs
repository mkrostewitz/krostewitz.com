export const DOWNLOAD_ACCESS_COOKIE = "verified_document_access";
export const DOWNLOAD_ACCESS_SECONDS = 24 * 60 * 60;

export function setDownloadAccessCookie(response, token, secure) {
  if (token) response.cookies.set(DOWNLOAD_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: DOWNLOAD_ACCESS_SECONDS,
  });
  return response;
}
