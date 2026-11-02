import {getApolloSender, apolloSenderStatus} from "./apolloSender.mjs";
import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

const text = value => typeof value === "string" ? value.slice(0, 300) : "";
export function normalizeApolloProgress(contact, campaigns = [], stages = [], sender = null) {
  const memberships = Array.isArray(contact.contact_campaign_statuses) ? contact.contact_campaign_statuses : null;
  const ids = new Set([...(Array.isArray(contact.emailer_campaign_ids) ? contact.emailer_campaign_ids : []), ...(memberships || []).map(item => item?.emailer_campaign_id)].filter(id => typeof id === "string"));
  return {
    configuredSender: sender,
    stageId: text(contact.contact_stage_id),
    stageName: text(stages.find(stage => stage.id === contact.contact_stage_id)?.name),
    membershipsKnown: memberships !== null || Array.isArray(contact.emailer_campaign_ids),
    sequences: [...ids].map(id => {
      const membership = memberships?.find(item => item?.emailer_campaign_id === id);
      const campaign = campaigns.find(item => item.id === id);
      const step = campaign?.emailer_steps?.find(item => item.id === membership?.current_step_id);
      return {id, name: text(campaign?.name) || id, status: text(membership?.status) || "unknown",
        stepId: text(membership?.current_step_id), stepNumber: Number.isInteger(step?.position) ? step.position : null,
        senderAccountId: text(membership?.send_email_from_email_account_id), senderEmail: text(membership?.send_email_from_email_address),
        senderStatus: apolloSenderStatus(membership, sender),
        stepType: text(step?.type), reason: text(membership?.failure_reason || membership?.inactive_reason),
        addedAt: text(membership?.added_at)};
    }),
  };
}

export async function getApolloProgress({contactId, apiKey, emailAccountId = "", fetchImpl = fetch}) {
  if (!/^[a-f0-9]{24}$/i.test(contactId || "")) throw new ApolloEnrichmentError("Invalid Apollo contact ID.", 400);
  async function read(path, permission, method = "GET") {
    let response;
    try { response = await fetchImpl(`https://api.apollo.io/api/v1/${path}`, {method, cache: "no-store", signal: AbortSignal.timeout(15000), headers: {accept: "application/json", "X-Api-Key": apiKey}}); }
    catch { throw new ApolloEnrichmentError("Unable to reach Apollo to refresh sequence progress."); }
    if (!response.ok) throw new ApolloEnrichmentError(response.status === 401 || response.status === 403
      ? `Apollo denied progress access. Check ${permission} in your API key permissions.`
      : `Unable to refresh Apollo progress (HTTP ${response.status}).`);
    try { return await response.json(); } catch { throw new ApolloEnrichmentError("Apollo returned unreadable progress."); }
  }
  const data = await read(`contacts/${contactId}`, "api/v1/contacts/show");
  if (data.contact?.id !== contactId) throw new ApolloEnrichmentError("Apollo did not return the linked contact.");
  const warnings = [];
  let stages = [], campaigns = [], sender = null;
  const initial = normalizeApolloProgress(data.contact);
  const results = await Promise.allSettled([
    emailAccountId ? getApolloSender({emailAccountId, apiKey, fetchImpl}).then(value => {sender = value;}) : Promise.resolve(),
    initial.stageId ? read("contact_stages", "api/v1/contact_stages/index").then(data => {
      if (!Array.isArray(data.contact_stages)) throw new Error("Apollo returned unexpected contact stages.");
      stages = data.contact_stages;
    }) : Promise.resolve(),
    (async () => {
      if (!initial.sequences.length) return;
      for (let page = 1; page <= 20; page++) {
        const data = await read(`emailer_campaigns/search?page=${page}&per_page=100`, "api/v1/emailer_campaigns/search", "POST");
        if (!Array.isArray(data.emailer_campaigns)) throw new Error("Apollo returned unexpected sequences.");
        campaigns.push(...data.emailer_campaigns);
        if (initial.sequences.every(item => campaigns.some(campaign => campaign.id === item.id))) return;
        if (page >= Number(data.pagination?.total_pages) || data.emailer_campaigns.length < 100) return;
      }
      warnings.push("Some sequence names could not be loaded; their Apollo IDs are shown.");
    })(),
  ]);
  for (const result of results) if (result.status === "rejected") warnings.push(result.reason.message);
  return {...normalizeApolloProgress(data.contact, campaigns, stages, sender), warnings, checkedAt: new Date().toISOString()};
}
