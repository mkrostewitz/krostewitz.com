export const config = {
  schedule: "* * * * *",
};

const SCHEDULER_FETCH_TIMEOUT_MS = 25000;

function isEnabled(value) {
  return ["1", "true", "yes", "on"].includes(
    String(value || "").trim().toLowerCase(),
  );
}

function getBatchLimit() {
  const limit = Number(process.env.LINKEDIN_SCHEDULER_BATCH_LIMIT || 1);

  if (!Number.isFinite(limit) || limit <= 0) return 1;

  return Math.min(5, Math.max(1, Math.floor(limit)));
}

export default async function handler(request) {
  const scheduledPayload = await request.json().catch(() => ({}));

  if (!isEnabled(process.env.LINKEDIN_SCHEDULER_ENABLED)) {
    console.log("LinkedIn scheduler is disabled.", scheduledPayload);
    return new Response(null, {status: 204});
  }

  const siteUrl = String(
    process.env.AUTH_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.URL || "",
  )
    .trim()
    .replace(/\/+$/, "");
  const secret = String(process.env.LINKEDIN_SCHEDULER_SECRET || "").trim();

  if (!siteUrl || !secret) {
    console.log("LinkedIn scheduler is not configured.", {
      hasSecret: Boolean(secret),
      hasSiteUrl: Boolean(siteUrl),
      nextRun: scheduledPayload.next_run || null,
    });
    return new Response(null, {status: 204});
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    SCHEDULER_FETCH_TIMEOUT_MS,
  );

  try {
    const response = await fetch(`${siteUrl}/api/admin/linkedin/scheduled`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({limit: getBatchLimit()}),
      signal: controller.signal,
    });
    const body = await response.text();

    console.log("LinkedIn scheduler run completed.", {
      nextRun: scheduledPayload.next_run || null,
      status: response.status,
      body,
    });

    return new Response(null, {status: response.ok ? 204 : 502});
  } catch (error) {
    console.error("LinkedIn scheduler run failed.", {
      error: error?.message || "Unknown scheduler error.",
      nextRun: scheduledPayload.next_run || null,
    });

    return new Response(null, {status: 502});
  } finally {
    clearTimeout(timeout);
  }
}
