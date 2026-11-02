import {after, NextResponse} from "next/server";
import {processApolloSyncQueue} from "../../../../../lib/leads";
import {validApolloSchedulerToken} from "../../../../../lib/apolloSyncQueue.mjs";

export const runtime = "nodejs";
export const maxDuration = 90;

export async function POST(request) {
  if (!validApolloSchedulerToken(request.headers.get("authorization"), process.env.AUTH_SECRET)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  after(async () => {
    try { await processApolloSyncQueue(); }
    catch { console.error("Apollo background sync interrupted; the queued job will be retried."); }
  });
  return NextResponse.json({accepted: true}, {status: 202});
}
