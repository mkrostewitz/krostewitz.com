"use server";

import {NextResponse} from "next/server";
import nodemailer from "nodemailer";

import {LeadValidationError, verifyPendingLead} from "../../../lib/leads";
import {getRequestOrigin} from "../../../lib/requestOrigin";

const getTransport = () => {
  const {APPLE_MAIL_USER, APPLE_MAIL_APP_PASSWORD} = process.env;
  if (!APPLE_MAIL_USER || !APPLE_MAIL_APP_PASSWORD) return null;

  return nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    auth: {
      user: APPLE_MAIL_USER,
      pass: APPLE_MAIL_APP_PASSWORD,
    },
  });
};

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

function formatRequestType(value) {
  return String(value || "")
    .split(/[_-]/)
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(" ");
}

function getRequesterSummaryLines(lead) {
  const isCvRequest = lead.source.type === "cv_download";

  return [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    lead.phone ? `Phone: ${lead.phone}` : "",
    isCvRequest ? `Request type: ${formatRequestType(lead.requestType)}` : "",
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

function getRequesterCopyText(lead, downloadUrl) {
  const isCvRequest = lead.source.type === "cv_download";

  return [
    `Hi ${lead.name || "there"},`,
    "",
    `Your ${isCvRequest ? "CV access request" : "contact request"} has been confirmed and received.`,
    "Here is a copy of the details you submitted:",
    "",
    ...getRequesterSummaryLines(lead),
    downloadUrl ? "" : null,
    downloadUrl ? `CV download: ${downloadUrl}` : null,
    "",
    isCvRequest
      ? "If anything needs to be corrected, please reply to this email."
      : "I will review your message and reply shortly.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function POST(request) {
  const {APPLE_MAIL_USER, APPLE_MAIL_FROM, APPLE_MAIL_TO} = process.env;
  const transporter = getTransport();
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
  const from = APPLE_MAIL_FROM || APPLE_MAIL_USER;
  const ownerMailOptions = {
    from,
    to: APPLE_MAIL_TO || APPLE_MAIL_USER,
    subject: isCvRequest
      ? `CV download request from ${lead.name}`
      : `New contact from ${lead.name}`,
    replyTo: lead.email,
    text: getOwnerNotificationText(lead),
  };
  const requesterCopyMailOptions = {
    from,
    to: lead.email,
    subject: isCvRequest
      ? "Copy of your CV access request"
      : "Copy of your contact request",
    replyTo: APPLE_MAIL_TO || APPLE_MAIL_USER,
    text: getRequesterCopyText(lead, requesterDownloadUrl || downloadUrl),
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
