import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

// Apollo's signed 64-bit IDs must not pass through JavaScript's lossy number type.
export function parseApolloJson(text) {
  return JSON.parse(text.replace(/("request_id"\s*:\s*)(-?\d+)(?=\s*[,}])/g, '$1"$2"'));
}

export function normalizeApolloPhones(person) {
  const values = Array.isArray(person?.phone_numbers) ? person.phone_numbers : [];
  return [...new Map(values.flatMap((item) => {
    const number = typeof item?.sanitized_number === "string" ? item.sanitized_number : item?.raw_number;
    if (typeof number !== "string" || !/^\+?[\d\s()./-]{5,40}$/.test(number)) return [];
    const label = (value) => typeof value === "string" ? value.slice(0, 80).replaceAll("_", " ") : "Not provided";
    return [[number, {number, type: label(item.type_cd || item.type), status: label(item.status_cd || item.status), doNotCall: label(item.dnc_status_cd)}]];
  })).values()];
}

export async function pollApolloPhone({requestId, personId, apiKey, fetchImpl = fetch}) {
  if (typeof requestId !== "string" || !/^-?\d{1,19}$/.test(requestId) || typeof personId !== "string" || !/^[a-f0-9]{24}$/i.test(personId)) throw new ApolloEnrichmentError("Invalid phone lookup reference.", 400);
  let response;
  try {
    response = await fetchImpl(`https://api.apollo.io/api/v1/webhook_result/${encodeURIComponent(requestId)}`, {
      cache: "no-store", headers: {accept: "application/json", "X-Api-Key": apiKey}, signal: AbortSignal.timeout(15000),
    });
  } catch { throw new ApolloEnrichmentError("Unable to check the phone lookup. Try checking again."); }
  const data = await response.json().catch(() => null);
  if (response.status === 404 && data?.error_code === "result_pending") {
    const retry = Number(data.retry_after_seconds);
    return {pending: true, retryAfter: Number.isFinite(retry) && retry > 0 ? Math.max(5, retry) : 10};
  }
  if (!response.ok) throw new ApolloEnrichmentError(response.status === 403 ? "Grant api/v1/webhook_result/show to your Apollo key, then check again."
    : response.status === 401 ? "Apollo rejected the API key. Check Integrations."
    : [400, 404, 410].includes(response.status) ? "This phone lookup is unavailable or expired. Run enrichment again."
    : "Unable to retrieve the phone result. Try checking again.");
  if (data?.request_type !== "phone" || !Array.isArray(data.webhook_result?.people)) throw new ApolloEnrichmentError("Apollo did not return a readable phone result. Try checking again.");
  const person = data.webhook_result.people.find((item) => item.id === personId);
  if (person?.status === "failed") throw new ApolloEnrichmentError("Apollo could not complete this phone lookup.");
  return {pending: false, phones: normalizeApolloPhones(person)};
}
