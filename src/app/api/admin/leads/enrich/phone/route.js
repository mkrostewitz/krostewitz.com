import {NextResponse} from "next/server";
import {getCurrentAdminUser, unauthorizedResponse} from "../../../../../lib/adminAuth";
import {getApolloApiKey} from "../../../../../lib/apolloSettings";
import {ApolloEnrichmentError} from "../../../../../lib/apolloEnrichment.mjs";
import {pollApolloPhone} from "../../../../../lib/apolloPhone.mjs";
export const runtime = "nodejs";
export const maxDuration = 30;
const reply = (body, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "no-store"}});
export async function GET(request) {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const params = new URL(request.url).searchParams;
    return reply(await pollApolloPhone({requestId: params.get("requestId"), personId: params.get("personId"), apiKey: await getApolloApiKey()}));
  } catch (error) {
    return reply({error: error instanceof ApolloEnrichmentError ? error.message : "Unable to retrieve phone enrichment."}, error instanceof ApolloEnrichmentError ? error.status : 502);
  }
}
