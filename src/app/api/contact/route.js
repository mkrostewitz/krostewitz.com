import "server-only";
import crypto from "crypto";
import {NextResponse} from "next/server";
import nodemailer from "nodemailer";

import {getDb} from "../../lib/mongo";

export const runtime = "nodejs";

const CONTACTS_COLLECTION = "contacts";

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
      {errorCode: "contact.mailNotConfigured"},
      {status: 500}
    );
  }

  const {name, email, message} = await request.json();

  if (!name || !email || !message) {
    return NextResponse.json(
      {errorCode: "contact.missingFields"},
      {status: 400}
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  const contacts = db.collection(CONTACTS_COLLECTION);

  const existing = await contacts.findOne({email: normalizedEmail});
  if (existing && existing.status === "verified") {
    return NextResponse.json(
      {errorCode: "contact.alreadyExists"},
      {status: 409}
    );
  }

  const verificationCode = crypto.randomInt(100000, 999999).toString();

  await contacts.updateOne(
    {email: normalizedEmail},
    {
      $set: {
        name,
        message,
        status: "pending",
        verificationCode,
        updatedAt: new Date(),
      },
      $setOnInsert: {createdAt: new Date()},
    },
    {upsert: true}
  );

  const mailOptions = {
    from: APPLE_MAIL_FROM || APPLE_MAIL_USER,
    to: normalizedEmail,
    subject: "Verify your contact request",
    text: `Hi ${name || "there"},\n\nPlease confirm your email to send your message:\n\nVerification code: ${verificationCode}\n\nIf you did not request this, you can ignore the email.`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return NextResponse.json({status: "verify_required"});
  } catch (error) {
    console.error("Contact verification send error", error);
    return NextResponse.json(
      {errorCode: "contact.sendFailed"},
      {status: 500}
    );
  }
}
