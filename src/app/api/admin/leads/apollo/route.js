import {after, NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../../lib/adminAuth";
import {LeadValidationError, updateAdminLead, syncAdminLeadToApollo, getAdminLeadApolloStatus, processApolloSyncQueue} from "../../../../lib/leads";
import {ApolloEnrichmentError} from "../../../../lib/apolloEnrichment.mjs";

import {normalizeApolloSequenceId} from "../../../../lib/apolloRouting.mjs";

export const runtime = "nodejs";
export const maxDuration = 90;
const reply = (body, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "no-store"}});

export async function POST(request) {
  if (!isSameOriginRequest(request)) return reply({error: "Invalid request origin."}, 403);
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    if (!body?.leadId) return reply({error: "Save the lead before linking it to Apollo."}, 400);
    let sequenceId;
    try { sequenceId = normalizeApolloSequenceId(body.sequenceId); }
    catch (error) { return reply({error: error.message}, 400); }
    await updateAdminLead(body.leadId, {contact: body.contact, leadTypes: body.categories || []}, user);
    const result = await syncAdminLeadToApollo(body.leadId, body.enroll === true, sequenceId);
    return reply({result});
  } catch (error) {
    return reply({error: (error instanceof ApolloEnrichmentError || error instanceof LeadValidationError || error.name === "OutreachValidationError") ? error.message : "Unable to send this contact to Apollo."}, (error instanceof ApolloEnrichmentError || error instanceof LeadValidationError || error.name === "OutreachValidationError") ? error.status : 502);
  }
}


export async function GET(request) {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const leadId = new URL(request.url).searchParams.get("leadId");
    const apollo = await getAdminLeadApolloStatus(leadId, {refresh: new URL(request.url).searchParams.get("refresh") === "1"});
    if (["pending", "retrying", "syncing"].includes(apollo?.status)) after(async () => {
      try { await processApolloSyncQueue(leadId); }
      catch { console.error("Apollo background sync interrupted; the queued job will be retried."); }
    });
    return reply({apollo});
  } catch (error) {
    return reply({error: error instanceof LeadValidationError ? error.message : "Unable to load Apollo sync status."}, error instanceof LeadValidationError ? error.status : 500);
  }
}
