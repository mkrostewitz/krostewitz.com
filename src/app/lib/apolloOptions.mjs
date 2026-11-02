import {getApolloLists} from "./apolloLists.mjs";
import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

export async function getApolloOptions({kind, page = 1, apiKey, fetchImpl = fetch}) {
  if (kind === "lists") return getApolloLists({apiKey, fetchImpl});
  if (!["sequences", "accounts"].includes(kind) || !Number.isInteger(page) || page < 1 || page > 10000) throw new ApolloEnrichmentError("Invalid Apollo options request.", 400);
  const sequences = kind === "sequences";
  const permission = sequences ? "api/v1/emailer_campaigns/search" : "api/v1/email_accounts/index";
  const path = sequences ? `emailer_campaigns/search?page=${page}&per_page=100` : "email_accounts";
  let response;
  try {
    response = await fetchImpl(`https://api.apollo.io/api/v1/${path}`, {
      method: sequences ? "POST" : "GET", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: {accept: "application/json", "X-Api-Key": apiKey},
    });
  } catch { throw new ApolloEnrichmentError("Unable to reach Apollo. Try refreshing the options."); }
  if (!response.ok) {
    throw new ApolloEnrichmentError(response.status === 403 ? `Apollo denied access. Grant ${permission} to your key and check your account's access.`
      : response.status === 401 ? "Apollo rejected the saved API key. Replace it in Integrations."
      : response.status === 429 ? "Apollo's rate limit was reached. Try again later."
      : "Unable to load options from Apollo. Try again later.", response.status === 429 ? 429 : 502);
  }
  let data;
  try { data = await response.json(); } catch { throw new ApolloEnrichmentError("Apollo returned unreadable options."); }
  const records = data?.[sequences ? "emailer_campaigns" : "email_accounts"];
  if (!Array.isArray(records)) throw new ApolloEnrichmentError("Apollo returned unexpected options.");
  // Return only dropdown metadata: email account responses can contain credentials and signatures.
  const options = records.filter((item) => item && typeof item.id === "string" && /^[a-f0-9]{24}$/i.test(item.id)).map((item) => ({
    id: item.id,
    label: String((sequences ? item.name : item.email) || "Unnamed").slice(0, 200),
    disabled: sequences ? item.archived === true : item.active === false || Boolean(item.revoked_at),
    status: sequences ? item.archived ? "Archived" : item.active ? "Active" : "Inactive" : item.active === false || item.revoked_at ? "Disconnected" : "Connected",
  }));
  const pages = Number(data.pagination?.total_pages);
  const hasMore = sequences && (Number.isFinite(pages) ? page < pages : records.length === 100);
  return {options, nextPage: hasMore ? page + 1 : null};
}
