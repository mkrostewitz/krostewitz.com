"use server";

import {NextResponse} from "next/server";

import {
  getAppleMailTransport,
  getDefaultSender,
} from "../../lib/mail";
import {renderLeadVerificationEmail} from "../../lib/emailTemplates";
import {createPendingLead, LeadValidationError} from "../../lib/leads";
import {getRequestOrigin} from "../../lib/requestOrigin";

export async function POST(request) {
  const transporter = getAppleMailTransport();
  if (!transporter) {
    return NextResponse.json(
      {errorCode: "contact.form.mailNotConfigured"},
      {status: 500}
    );
  }

  const body = await request.json().catch(() => ({}));
  let lead;
  let verificationCode;

  try {
    const result = await createPendingLead(body, request);
    lead = result.lead;
    verificationCode = result.verificationCode;
  } catch (error) {
    if (error instanceof LeadValidationError) {
      return NextResponse.json(
        {error: error.message, errorCode: error.errorCode},
        {status: error.status}
      );
    }

    console.error("Lead create error", error);
    return NextResponse.json(
      {errorCode: "contact.form.errorGeneric"},
      {status: 500}
    );
  }

  const isCvRequest = lead.source.type === "cv_download";
  const mailOptions = {
    from: getDefaultSender(),
    to: lead.email,
    subject: isCvRequest ? "Verify your CV request" : "Verify your contact request",
    text: `Hi ${
      lead.name || "there"
    },\n\nPlease confirm your email to ${
      isCvRequest ? "access the CV download" : "send your message"
    }:\n\nVerification code: ${verificationCode}\n\nIf you did not request this, you can ignore the email.`,
    html: await renderLeadVerificationEmail({
      lead,
      origin: getRequestOrigin(request),
      verificationCode,
    }),
  };

  try {
    await transporter.sendMail(mailOptions);
    return NextResponse.json({status: "verify_required", leadId: lead.id});
  } catch (error) {
    console.error("Contact verification send error", error);
    return NextResponse.json(
      {errorCode: "contact.form.sendFailed"},
      {status: 500}
    );
  }
}
