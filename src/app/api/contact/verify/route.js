"use server";

import {NextResponse} from "next/server";

import {
  getAppleMailTransport,
  getDefaultSender,
} from "../../../lib/mail";
import {
  getRequesterCopyEmailSubject,
  getRequesterCopyEmailText,
  renderOwnerLeadNotificationEmail,
  renderRequesterCopyEmail,
} from "../../../lib/emailTemplates";
import {LeadValidationError, verifyPendingLead} from "../../../lib/leads";
import {getRequestOrigin} from "../../../lib/requestOrigin";

function getRequestSummaryLines(lead) {
  return [
    `Source: ${lead.source.label || lead.source.type}`,
    `Request type: ${lead.requestType}`,
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : "",
    lead.message ? `Message:\n${lead.message}` : "",
  ].filter(Boolean);
}

function getOwnerNotificationText(lead) {
  const tracking = lead.tracking || {};

  return [
    ...getRequestSummaryLines(lead),
    "",
    "Tracking:",
    `IP: ${tracking.ip || "Unknown"}`,
    `Country: ${tracking.country || "Unknown"}`,
    `State: ${tracking.state || "Unknown"}`,
    `Address: ${tracking.address || "Unknown"}`,
    `Page: ${tracking.pageUrl || tracking.referrer || "Unknown"}`,
    `User agent: ${tracking.userAgent || "Unknown"}`,
  ].join("\n");
}

export async function POST(request) {
  const {APPLE_MAIL_USER, APPLE_MAIL_TO} = process.env;
  const transporter = getAppleMailTransport();
  if (!transporter) {
    return NextResponse.json(
      {errorCode: "contact.form.mailNotConfigured"},
      {status: 500}
    );
  }

  const body = await request.json().catch(() => ({}));
  let lead;
  let downloadUrl = "";
  let requesterDownloadUrl = "";

  try {
    const result = await verifyPendingLead(body);
    lead = result.lead;

    if (result.downloadToken) {
      const url = new URL("/api/cv/download", getRequestOrigin(request));
      url.searchParams.set("token", result.downloadToken);
      downloadUrl = `${url.pathname}${url.search}`;
      requesterDownloadUrl = url.toString();
    }
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return NextResponse.json(
        {error: error.message, errorCode: error.errorCode},
        {status: error.status}
      );
    }

    console.error("Contact verification error", error);
    return NextResponse.json(
      {errorCode: "contact.form.errorGeneric"},
      {status: 500}
    );
  }

  // Send the actual message to us after verification
  const isCvRequest = lead.source.type === "cv_download";
  const origin = getRequestOrigin(request);
  const from = getDefaultSender();
  const ownerMailOptions = {
    from,
    to: APPLE_MAIL_TO || APPLE_MAIL_USER,
    subject: isCvRequest
      ? `CV download request from ${lead.name}`
      : `New contact from ${lead.name}`,
    replyTo: lead.email,
    text: getOwnerNotificationText(lead),
    html: await renderOwnerLeadNotificationEmail({lead, origin}),
  };
  const requesterCopyMailOptions = {
    from,
    to: lead.email,
    subject: await getRequesterCopyEmailSubject(lead),
    replyTo: APPLE_MAIL_TO || APPLE_MAIL_USER,
    text: await getRequesterCopyEmailText(
      lead,
      requesterDownloadUrl || downloadUrl
    ),
    html: await renderRequesterCopyEmail({
      lead,
      origin,
      downloadUrl: requesterDownloadUrl || downloadUrl,
    }),
  };

  try {
    const [ownerResult, requesterCopyResult] = await Promise.allSettled([
      transporter.sendMail(ownerMailOptions),
      transporter.sendMail(requesterCopyMailOptions),
    ]);
    const warnings = [];

    if (ownerResult.status === "rejected") {
      console.error("Contact final send error", ownerResult.reason);
      warnings.push("notify_failed");
    }

    if (requesterCopyResult.status === "rejected") {
      console.error("Contact requester copy send error", requesterCopyResult.reason);
      warnings.push("copy_failed");
    }

    return NextResponse.json({
      ok: true,
      lead,
      downloadUrl,
      ...(warnings.length ? {warning: warnings.join(",")} : {}),
    });
  } catch (error) {
    console.error("Contact final send error", error);
    return NextResponse.json({
      ok: true,
      lead,
      downloadUrl,
      warning: "notify_failed",
    });
  }
}
