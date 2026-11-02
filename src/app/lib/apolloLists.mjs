import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

export function validateApolloListName(name) {
  if (typeof name !== "string" || !name.trim() || name.trim().length > 200 || /[\x00-\x1f]/.test(name)) {
    throw new ApolloEnrichmentError("Enter a list name between 1 and 200 characters.", 400);
  }
  return name.trim();
}

async function requestLists({apiKey, name, fetchImpl = fetch}) {
  const creating = name !== undefined;
  let response;
  try {
    response = await fetchImpl("https://api.apollo.io/api/v1/labels", {
      method: creating ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: {accept: "application/json", "Content-Type": "application/json", "X-Api-Key": apiKey},
      ...(creating ? {body: JSON.stringify({name: validateApolloListName(name), modality: "contacts"})} : {}),
    });
  } catch (error) {
    if (error instanceof ApolloEnrichmentError) throw error;
    throw Object.assign(new ApolloEnrichmentError(creating ? "Apollo did not confirm list creation. Refresh the lists before retrying." : "Unable to load Apollo lists. Try refreshing."), {retryable: !creating});
  }
  if (!response.ok) throw Object.assign(new ApolloEnrichmentError(response.status === 403
    ? `Apollo denied list access. Grant api/v1/labels/${creating ? "create" : "index"} to the saved key and check your workspace permissions.`
    : response.status === 401 ? "Apollo rejected the saved API key. Replace it in Integrations."
    : response.status === 422 && creating ? "Apollo rejected this list name. It may already exist; refresh and select the existing list."
    : response.status === 429 ? "Apollo's rate limit was reached. Try again later."
    : `Unable to ${creating ? "create" : "load"} Apollo lists (HTTP ${response.status}).`, response.status === 429 ? 429 : 502), {retryable: !creating && (response.status === 429 || response.status >= 500)});
  try { return await response.json(); }
  catch { throw new ApolloEnrichmentError("Apollo returned an unreadable list response. Refresh before retrying."); }
}

function option(item) {
  const id = item?.id || item?._id;
  if (item?.modality !== "contacts" || !/^[a-f0-9]{24}$/i.test(id || "") || typeof item.name !== "string" || !item.name.trim()) return null;
  return {id, label: item.name, disabled: false, status: Number.isInteger(item.cached_count) ? `${item.cached_count} contacts` : "Contact list"};
}

export async function getApolloLists(args) {
  const data = await requestLists(args);
  const records = Array.isArray(data) ? data : data?.labels;
  if (!Array.isArray(records)) throw new ApolloEnrichmentError("Apollo returned unexpected lists.");
  return {options: records.map(option).filter(Boolean).sort((a, b) => a.label.localeCompare(b.label)), nextPage: null};
}

export async function createApolloList(args) {
  const data = await requestLists({...args, name: validateApolloListName(args.name)});
  const created = option(data?.label);
  if (!created) throw new ApolloEnrichmentError("Apollo did not confirm the new contact list. Refresh before retrying.");
  return created;
}
