import crypto from "node:crypto";
import {NextResponse} from "next/server";
import {processNewsletter} from "../../../../lib/newsletter";

export const runtime = "nodejs";
export async function POST(request) {
  const secret = process.env.NEWSLETTER_SCHEDULER_SECRET || "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") || "");
  if (!secret || actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401});
  }
  try {
    return NextResponse.json(await processNewsletter());
  } catch {
    console.error("Newsletter scheduler failed; check MongoDB, SMTP and site URL configuration.");
    return NextResponse.json({error: "Newsletter processing failed"}, {status: 503});
  }
}
