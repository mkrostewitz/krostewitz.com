import {NextResponse} from "next/server";
import nodemailer from "nodemailer";

import {getDb} from "../../../lib/mongo";

const {
  APPLE_MAIL_USER,
  APPLE_MAIL_APP_PASSWORD,
  APPLE_MAIL_FROM,
  APPLE_MAIL_TO,
} = process.env;

const CONTACTS_COLLECTION = "contacts";

const transporter =
  APPLE_MAIL_USER && APPLE_MAIL_APP_PASSWORD
    ? nodemailer.createTransport({
        host: "smtp.mail.me.com",
        port: 587,
        secure: false,
        auth: {
          user: APPLE_MAIL_USER,
          pass: APPLE_MAIL_APP_PASSWORD,
        },
      })
    : null;

export async function POST(request) {
  if (!transporter) {
    return NextResponse.json(
      {errorCode: "contact.mailNotConfigured"},
      {status: 500}
    );
  }

  const {email, code} = await request.json();

  if (!email || !code) {
    return NextResponse.json(
      {errorCode: "contact.missingFields"},
      {status: 400}
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = await getDb();
  const contacts = db.collection(CONTACTS_COLLECTION);

  const existing = await contacts.findOne({
    email: normalizedEmail,
    status: "pending",
  });

  if (!existing) {
    return NextResponse.json(
      {errorCode: "contact.notFound"},
      {status: 404}
    );
  }

  if (existing.verificationCode !== code) {
    return NextResponse.json(
      {errorCode: "contact.invalidCode"},
      {status: 400}
    );
  }

  await contacts.updateOne(
    {email: normalizedEmail},
    {
      $set: {
        status: "verified",
        verificationCode: null,
        verifiedAt: new Date(),
        updatedAt: new Date(),
      },
    }
  );

  // Send the actual message to us after verification
  const mailOptions = {
    from: APPLE_MAIL_FROM || APPLE_MAIL_USER,
    to: APPLE_MAIL_TO || APPLE_MAIL_USER,
    subject: `New contact from ${existing.name}`,
    replyTo: normalizedEmail,
    text: `Name: ${existing.name}\nEmail: ${normalizedEmail}\n\nMessage:\n${existing.message}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return NextResponse.json({ok: true});
  } catch (error) {
    console.error("Contact final send error", error);
    return NextResponse.json(
      {errorCode: "contact.sendFailed"},
      {status: 500}
    );
  }
}
