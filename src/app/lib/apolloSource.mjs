import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

export function sourceFieldId(field, label = "Website Source") {
  if (field?.label?.trim().toLowerCase() !== label.toLowerCase() || field.modality !== "contact" || field.type !== "string" || (field.meta?.computed_type && field.meta.computed_type !== "manual")) return null;
  const id = field.id?.replace(/^contact\./, "");
  return /^[a-f0-9]{24}$/i.test(id || "") ? id : null;
}

export async function ensureApolloSourceField({apiKey, fetchImpl = fetch, label = "Website Source", maxLength = 200}) {
  async function request(method, path, body) {
    let response;
    try { response = await fetchImpl(`https://api.apollo.io/api/v1/${path}`, {
      method, headers: {"X-Api-Key": apiKey, "Content-Type": "application/json", accept: "application/json"},
      cache: "no-store", signal: AbortSignal.timeout(15000), ...(body ? {body: JSON.stringify(body)} : {}),
    }); } catch { throw Object.assign(new ApolloEnrichmentError(`Apollo ${label} field setup could not connect. Try again.`), {retryable: true}); }
    if (!response.ok) throw Object.assign(new ApolloEnrichmentError(`Apollo ${label} field setup failed (HTTP ${response.status}). Check api/v1/fields/${method === "GET" ? "index" : "create"} permissions and custom-field access.`), {retryable: response.status === 429 || response.status >= 500});
    return response.json();
  }
  const data = await request("GET", "fields?source=custom");
  if (!Array.isArray(data.fields)) throw new ApolloEnrichmentError("Apollo returned an unreadable custom-field list.");
  const matches = data.fields.filter((field) => field.modality === "contact" && field.label?.trim().toLowerCase() === label.toLowerCase());
  if (matches.length) {
    const id = matches.length === 1 && sourceFieldId(matches[0], label);
    if (!id) throw new ApolloEnrichmentError(`Apollo ${label} must be one editable single-line text contact field. Check its field settings.`, 400);
    return id;
  }
  const created = await request("POST", "fields", {label, modality: "contact", type: "string", meta: {max_length: maxLength}});
  const id = sourceFieldId(created.field || created, label);
  if (!id) throw new ApolloEnrichmentError(`Apollo did not confirm the ${label} field. Refresh before retrying.`);
  return id;
}
