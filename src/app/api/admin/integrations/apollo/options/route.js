import {createApolloList} from "../../../../../lib/apolloLists.mjs";
import {NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../../../lib/adminAuth";
import {getApolloApiKey} from "../../../../../lib/apolloSettings";
import {getApolloOptions} from "../../../../../lib/apolloOptions.mjs";
import {ApolloEnrichmentError} from "../../../../../lib/apolloEnrichment.mjs";

export const runtime = "nodejs";
const reply = (body, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "no-store"}});
export async function GET(request) {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const params = new URL(request.url).searchParams;
    const apiKey = await getApolloApiKey({requireEnabled: false});
    return reply(await getApolloOptions({apiKey, kind: params.get("kind"), page: Number(params.get("page") || 1)}));
  } catch (error) {
    return reply({error: error instanceof ApolloEnrichmentError ? error.message : "Unable to load Apollo options."}, error instanceof ApolloEnrichmentError ? error.status : 500);
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return reply({error: "Invalid request origin."}, 403);
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    const apiKey = await getApolloApiKey({requireEnabled: false});
    return reply({option: await createApolloList({apiKey, name: body?.name})});
  } catch (error) {
    return reply({error: error instanceof ApolloEnrichmentError ? error.message : "Unable to create an Apollo list."}, error instanceof ApolloEnrichmentError ? error.status : 500);
  }
}
