import {getDb} from "../../../../lib/mongo";
import {categorySequenceRows} from "../../../../lib/apolloRouting.mjs";
import {getAdminLeadTypes} from "../../../../lib/leads";
import {NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../../lib/adminAuth";
import {getApolloSettings, saveApolloSettings} from "../../../../lib/apolloSettings";
import {ApolloEnrichmentError} from "../../../../lib/apolloEnrichment.mjs";

export const runtime = "nodejs";
const reply = (body, status = 200) => NextResponse.json(body, {status, headers: {"Cache-Control": "no-store"}});

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const db = await getDb();
    const [settings, catalog, tags, legacyTypes] = await Promise.all([
      getApolloSettings(), getAdminLeadTypes(),
      db.collection("leads").distinct("leadTypes"),
      db.collection("leads").distinct("leadType"),
    ]);
    const leadTypes = categorySequenceRows([...catalog, ...tags, ...legacyTypes].filter((value) => typeof value === "string"), settings.sequenceRules).map((row) => row.category);
    return reply({settings, leadTypes});
  }
  catch { return reply({error: "Unable to load Apollo settings."}, 500); }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) return reply({error: "Invalid request origin."}, 403);
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    return reply({settings: await saveApolloSettings(await request.json().catch(() => null), user)});
  } catch (error) {
    return reply({error: error instanceof ApolloEnrichmentError ? error.message : "Unable to save Apollo settings."}, error instanceof ApolloEnrichmentError ? error.status : 500);
  }
}
