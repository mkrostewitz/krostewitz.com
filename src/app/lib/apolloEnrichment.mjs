import {normalizeApolloPhones, parseApolloJson} from "./apolloPhone.mjs";
import {normalizeLinkedinProfileUrl} from "./linkedinProfile.mjs";

export class ApolloEnrichmentError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = "ApolloEnrichmentError";
    this.status = status;
  }
}

export function apolloIdentity(contact = {}) {
  const field = (key) => typeof contact?.[key] === "string" ? contact[key].trim().slice(0, 200) : "";
  let linkedinUrl;
  try { linkedinUrl = normalizeLinkedinProfileUrl(contact?.linkedinUrl); }
  catch (error) { throw new ApolloEnrichmentError(error.message, 400); }
  const identity = {first_name: field("firstName"), last_name: field("lastName"), organization_name: field("company"), linkedin_url: linkedinUrl};
  if (!linkedinUrl && !(identity.first_name && identity.last_name && identity.organization_name)) {
    const missing = [["first_name", "First name"], ["last_name", "Last name"], ["organization_name", "Company"]]
      .filter(([key]) => !identity[key]).map(([, label]) => label);
    throw new ApolloEnrichmentError(`To enrich this contact, add a LinkedIn personal profile URL or complete: ${missing.join(", ")}.`, 400);
  }
  return Object.fromEntries(Object.entries(identity).filter(([, value]) => value));
}

export function apolloEnrichmentIssue(contact) {
  try {
    apolloIdentity(contact);
    return "";
  } catch (error) {
    return error.message;
  }
}

export function parseApolloResult(data) {
  if (!data || typeof data !== "object" || !Object.hasOwn(data, "person")) {
    throw new ApolloEnrichmentError("Apollo returned an unreadable result. Please try again.");
  }
  const person = data.person;
  const confidence = ["high", "medium", "low", "none"].includes(data.match_confidence) ? data.match_confidence : "unknown";
  if (!person || confidence === "none") return {matched: false, email: "", matchConfidence: confidence};
  const text = (value) => typeof value === "string" ? value.trim().slice(0, 200) : "";
  const candidate = text(person.email).toLowerCase();
  // Apollo can return a masked placeholder instead of a revealed address.
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) && !candidate.includes("*") && !candidate.endsWith("@domain.com") ? candidate : "";
  return {
    matched: true, email, matchConfidence: confidence,
    emailStatus: text(person.email_status) || "unknown",
    name: text(person.name), company: text(person.organization?.name), title: text(person.title),
  };
}

export async function enrichWithApollo({contact, apiKey, includePhone = false, fetchImpl = fetch}) {
  const identity = apolloIdentity(contact);
  if (!apiKey?.trim()) throw new ApolloEnrichmentError("Add your Apollo API key in Integrations to find emails.", 503);
  let response;
  try {
    response = await fetchImpl("https://api.apollo.io/api/v1/people/match", {
      method: "POST", cache: "no-store", signal: AbortSignal.timeout(20000),
      headers: {"Content-Type": "application/json", accept: "application/json", "X-Api-Key": apiKey.trim()},
      body: JSON.stringify({...identity, reveal_personal_emails: false, reveal_phone_number: includePhone === true, ...(includePhone ? {poll_only: true} : {}), run_waterfall_email: false, run_waterfall_phone: false}),
    });
  } catch (error) {
    throw new ApolloEnrichmentError(error.name === "TimeoutError" ? "Apollo took too long. Please try again." : "Unable to reach Apollo. Please try again.");
  }
  if (!response.ok) {
    const messages = {
      400: "Apollo could not use these contact details. Check the name, company and LinkedIn URL.",
      401: "Apollo rejected the API key. Update the API key in Integrations.",
      402: "Apollo credits are exhausted. Check your Apollo account.",
      403: "Apollo enrichment is unavailable for this API key or account. Check its People Enrichment access.",
      429: "Apollo's rate or credit limit was reached. Check your account or try again later.",
    };
    throw new ApolloEnrichmentError(messages[response.status] || "Apollo enrichment is temporarily unavailable. Please try again.", response.status === 429 ? 429 : 502);
  }
  let data;
  try { data = includePhone ? parseApolloJson(await response.text()) : await response.json(); }
  catch { throw new ApolloEnrichmentError("Apollo returned an unreadable result. Please try again."); }
  const result = parseApolloResult(data);
  if (includePhone && result.matched) {
    result.phones = normalizeApolloPhones(data.person);
    result.phonePersonId = data.person.id;
    result.phoneRequestId = typeof data.request_id === "string" && /^-?\d{1,19}$/.test(data.request_id) ? data.request_id : null;
    result.phoneRequested = true;
  }
  return result;
}
