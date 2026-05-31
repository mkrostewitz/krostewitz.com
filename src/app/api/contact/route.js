"use server";

import {NextResponse} from "next/server";
import nodemailer from "nodemailer";

import {createPendingLead, LeadValidationError} from "../../lib/leads";

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

export async function POST(request) {
  const {APPLE_MAIL_USER, APPLE_MAIL_FROM} = process.env;
  const transporter = getTransport();
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
    from: APPLE_MAIL_FROM || APPLE_MAIL_USER,
    to: lead.email,
    subject: isCvRequest ? "Verify your CV request" : "Verify your contact request",
    text: `Hi ${
      lead.name || "there"
    },\n\nPlease confirm your email to ${
      isCvRequest ? "access the CV download" : "send your message"
    }:\n\nVerification code: ${verificationCode}\n\nIf you did not request this, you can ignore the email.`,
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
