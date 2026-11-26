// Check the HttpOnly session on every click so expired access opens registration.
export async function downloadWithExistingAccess(path, parameters = {}) {
  try {
    const response = await fetch("/api/download-access", {cache: "no-store"});
    if (!response.ok) return false;
    const {verified} = await response.json();
    if (!verified) return false;
    const query = new URLSearchParams(parameters);
    window.location.assign(`${path}?${query}`);
    return true;
  } catch {
    return false;
  }
}
