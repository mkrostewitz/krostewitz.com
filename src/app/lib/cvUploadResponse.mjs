export async function readCvUploadResponse(response, requireAsset = true) {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.error) throw new Error(data.error);
    const messages = {
      413: "The hosting server rejected this PDF because the upload is too large. Try a PDF smaller than 4 MB.",
      401: "Your admin session has expired. Sign in again before uploading.",
      403: "The server refused this upload. Reload the page and sign in again.",
      502: "The production upload service failed. Check the Netlify function logs for this request.",
      504: "The production upload timed out. Please retry; if it persists, check the Netlify function logs.",
    };
    const requestId = response.headers.get("x-nf-request-id");
    throw new Error(`${messages[response.status] || "The CV upload failed."} (HTTP ${response.status}${requestId ? `; request ${requestId}` : ""})`);
  }
  if (!data || (requireAsset && (!data.downloads || !data.asset))) throw new Error("The upload server returned an unexpected response. Reload the page and try again.");
  return data;
}
