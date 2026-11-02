import {apolloSchedulerToken} from "../../src/app/lib/apolloSyncQueue.mjs";

export default async function handler() {
  const token = apolloSchedulerToken(process.env.AUTH_SECRET);
  const origin = process.env.DEPLOY_PRIME_URL || process.env.URL || process.env.DEPLOY_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_BASE_URL;
  if (!token || !origin) return new Response(null, {status: 204});
  try {
    const response = await fetch(new URL("/api/admin/leads/apollo/scheduled", origin), {
      method: "POST", headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(25000),
    });
    return new Response(null, {status: response.ok ? 204 : 502});
  } catch {
    console.error("Apollo scheduler request failed.");
    return new Response(null, {status: 502});
  }
}
