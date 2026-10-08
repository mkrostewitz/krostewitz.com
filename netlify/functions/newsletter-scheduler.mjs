export default async function handler() {
  const secret = process.env.NEWSLETTER_SCHEDULER_SECRET;
  const origin = process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_BASE_URL || process.env.URL;
  if (!secret || !origin) return new Response(null, {status: 204});
  try {
    const response = await fetch(new URL("/api/admin/newsletter/scheduled", origin), {
      method: "POST",
      headers: {Authorization: `Bearer ${secret}`},
      signal: AbortSignal.timeout(25000),
    });
    console.log("Newsletter scheduler", response.status, await response.text());
    return new Response(null, {status: response.ok ? 204 : 502});
  } catch {
    console.error("Newsletter scheduler request failed.");
    return new Response(null, {status: 502});
  }
}
