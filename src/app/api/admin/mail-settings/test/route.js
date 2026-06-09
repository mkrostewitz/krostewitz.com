import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {renderBrandedEmail} from "../../../../lib/emailTemplates";
import {sendMail} from "../../../../lib/mail";
import {getOriginHost, getRequestOrigin} from "../../../../lib/requestOrigin";

export const runtime = "nodejs";

function skippedError(result = {}) {
  if (result.reason === "disabled") return "Email delivery is disabled.";
  if (result.reason === "missing_recipient") {
    return "No notification recipient is configured.";
  }
  if (result.reason === "not_configured") {
    const missing = Array.isArray(result.missing) ? result.missing.join(", ") : "";
    return missing
      ? `Email delivery is missing: ${missing}.`
      : "Email delivery is not fully configured.";
  }

  return "Unable to send test email.";
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const sentAt = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const origin = getRequestOrigin(request);
    const siteHost = getOriginHost(origin);
    const result = await sendMail({
      subject: `${siteHost} mail settings verified`,
      text: [
        `${siteHost} mail settings can send email successfully.`,
        "",
        `Sent at: ${sentAt}`,
        `Requested by: ${user.email}`,
      ].join("\n"),
      html: await renderBrandedEmail({
        origin,
        preheader: `${siteHost} mail settings can send email successfully.`,
        eyebrow: "Mail settings",
        title: "Mail delivery verified",
        paragraphs: [
          `${siteHost} mail settings can send email successfully.`,
          "This message was generated from the admin Mail & Calendar settings.",
        ],
        details: [
          {label: "Sent at", value: sentAt},
          {label: "Requested by", value: user.email},
        ],
      }),
    });

    if (result.skipped) {
      return NextResponse.json({error: skippedError(result)}, {status: 400});
    }

    if (!result.ok) {
      return NextResponse.json(
        {error: "Unable to send test email."},
        {status: 502}
      );
    }

    return NextResponse.json({
      ok: true,
      accepted: result.accepted || [],
      rejected: result.rejected || [],
    });
  } catch (error) {
    console.error("Admin test email error", error);
    return NextResponse.json(
      {error: error?.message || "Unable to send test email."},
      {status: 502}
    );
  }
}
