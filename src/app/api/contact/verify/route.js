"use server";

import {NextResponse} from "next/server";

import {
  getAppleMailTransport,
  getDefaultRecipients,
  getDefaultSender,
} from "../../../lib/mail";
import {
  getRequesterCopyEmailSubject,
  getRequesterCopyEmailText,
  renderOwnerLeadNotificationEmail,
  renderRequesterCopyEmail,
} from "../../../lib/emailTemplates";
import {getCvDownloads} from "../../../lib/cvFiles";
import {LeadValidationError, verifyPendingLead} from "../../../lib/leads";
import {getRequestOrigin} from "../../../lib/requestOrigin";

const CV_DOWNLOAD_LANGUAGE_ORDER = ["en", "de"];

function addLanguageToDownloadUrl(downloadUrl, language) {
  const url = new URL(downloadUrl);
  url.searchParams.set("language", language);
  return url.toString();
}

function sortCvDownloadEntries(entries, preferredLanguage) {
  return entries.sort(([firstLanguage], [secondLanguage]) => {
    if (firstLanguage === preferredLanguage) return -1;
    if (secondLanguage === preferredLanguage) return 1;

    const firstIndex = CV_DOWNLOAD_LANGUAGE_ORDER.indexOf(firstLanguage);
    const secondIndex = CV_DOWNLOAD_LANGUAGE_ORDER.indexOf(secondLanguage);

    return (
      (firstIndex === -1 ? Number.MAX_SAFE_INTEGER : firstIndex) -
      (secondIndex === -1 ? Number.MAX_SAFE_INTEGER : secondIndex)
    );
  });
}

async function getRequesterDownloadLinks(downloadUrl, lead) {
  if (!downloadUrl || lead.source?.type !== "cv_download") return [];

  try {
    const downloads = await getCvDownloads();
    const preferredLanguage = lead.source?.context?.cvLanguage || lead.language || "en";

    return sortCvDownloadEntries(
      Object.entries(downloads).filter(([, asset]) => asset?.url),
      preferredLanguage
    ).map(([language]) => ({
      href: addLanguageToDownloadUrl(downloadUrl, language),
      language,
    }));
  } catch (error) {
    console.warn("Unable to build CV download links for requester email", error);
    return [];
  }
}

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
  const transporter = await getAppleMailTransport();
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
  let requesterDownloadLinks = [];

  try {
    const result = await verifyPendingLead(body);
    lead = result.lead;

    if (result.downloadToken) {
      const url = new URL("/api/cv/download", getRequestOrigin(request));
      url.searchParams.set("token", result.downloadToken);
      downloadUrl = `${url.pathname}${url.search}`;
      requesterDownloadUrl = url.toString();
      requesterDownloadLinks = await getRequesterDownloadLinks(
        requesterDownloadUrl,
        lead
      );
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
  const from = await getDefaultSender();
  const notificationRecipients = await getDefaultRecipients();
  const ownerRecipient = notificationRecipients[0] || from;
  const requesterDownloadHref = requesterDownloadUrl || downloadUrl;
  const ownerMailOptions = {
    from,
    to: notificationRecipients,
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
    replyTo: ownerRecipient,
    text: await getRequesterCopyEmailText(
      lead,
      requesterDownloadHref,
      requesterDownloadLinks
    ),
    html: await renderRequesterCopyEmail({
      lead,
      origin,
      downloadUrl: requesterDownloadHref,
      downloadLinks: requesterDownloadLinks,
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
