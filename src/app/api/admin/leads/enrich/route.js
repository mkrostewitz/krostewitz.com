import {NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../../lib/adminAuth";
import {ApolloEnrichmentError, enrichWithApollo} from "../../../../lib/apolloEnrichment.mjs";
import {getApolloApiKey, getApolloSettings} from "../../../../lib/apolloSettings";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const {available, listEnabled, sequenceEnabled, sequenceId, sequenceName, sequenceRules, sourceSequenceRules} = await getApolloSettings();
    return NextResponse.json({available, listEnabled, sequenceEnabled, sequenceId, sequenceName, sequenceRules, sourceSequenceRules}, {headers: {"Cache-Control": "no-store"}});
  } catch {
    return NextResponse.json({available: false}, {status: 503, headers: {"Cache-Control": "no-store"}});
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    const apiKey = await getApolloApiKey();
    const result = await enrichWithApollo({contact: body?.contact, apiKey, includePhone: body?.includePhone === true});
    return NextResponse.json({result}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    return NextResponse.json({error: error instanceof ApolloEnrichmentError ? error.message : "Unable to enrich this contact."},
      {status: error instanceof ApolloEnrichmentError ? error.status : 502, headers: {"Cache-Control": "no-store"}});
  }
}
