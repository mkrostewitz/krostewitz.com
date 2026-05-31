export const config = {
  schedule: "*/15 * * * *",
};

export default async function handler() {
  const siteUrl = String(
    process.env.NEXT_PUBLIC_SITE_URL || process.env.AUTH_BASE_URL || process.env.URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  const secret = String(process.env.LINKEDIN_SCHEDULER_SECRET || "").trim();

  if (!siteUrl || !secret) {
    return new Response("LinkedIn scheduler is not configured.", {status: 204});
  }

  const response = await fetch(`${siteUrl}/api/admin/linkedin/scheduled`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({limit: 5}),
  });
  const body = await response.text();

  return new Response(body, {
    status: response.status,
    headers: {"Content-Type": "application/json"},
  });
}
