import nodemailer from "nodemailer";

export function isAppleMailConfigured() {
  return Boolean(process.env.APPLE_MAIL_USER && process.env.APPLE_MAIL_APP_PASSWORD);
}

export function getAppleMailTransport() {
  if (!isAppleMailConfigured()) return null;

  const {APPLE_MAIL_USER, APPLE_MAIL_APP_PASSWORD} = process.env;

  return nodemailer.createTransport({
    host: "smtp.mail.me.com",
    port: 587,
    secure: false,
    auth: {
      user: APPLE_MAIL_USER,
      pass: APPLE_MAIL_APP_PASSWORD,
    },
  });
}

export function getDefaultSender() {
  return process.env.APPLE_MAIL_FROM || process.env.APPLE_MAIL_USER;
}
