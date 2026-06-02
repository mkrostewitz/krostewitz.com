import "server-only";

import {FALLBACK_LANGUAGE} from "../../lib/languageDetection";
import {getSupportedSiteLanguage} from "../../lib/siteLanguages";
import {resources as bundledTranslationResources} from "../../lib/translationResources";
import {getRuntimeTranslationResources} from "./siteContent";
import {getDefaultSiteMetadata, getSiteMetadata} from "./siteProfile";

const THEME = {
  background: "#0f1117",
  surface: "#171a22",
  surfaceElevated: "#1d222d",
  surfaceMuted: "#202632",
  border: "rgba(244, 244, 245, 0.16)",
  borderStrong: "rgba(244, 244, 245, 0.24)",
  foreground: "#f4f4f5",
  textSecondary: "#d8dde5",
  textMuted: "#a8b0bd",
  accent: "#8ea2ff",
  accentContrast: "#111827",
  accentSoft: "rgba(142, 162, 255, 0.14)",
};

const INTERNAL_REQUEST_TYPE_LABELS = {
  general: "General",
  headhunter: "Headhunter",
  employer: "Employer",
  potential_client: "Potential client",
  fan: "Fan",
  other: "Other",
};

const INTERNAL_EMAIL_COPY = {
  fields: {
    source: "Source",
    requestType: "Request type",
    name: "Name",
    email: "Email",
    phone: "Phone",
    message: "Message",
  },
  sources: {
    contact_form: "Contact form",
    cv_download: "CV download",
  },
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlText(value) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function cleanText(value) {
  return String(value || "").trim();
}

function getEmailLanguage(language) {
  return getSupportedSiteLanguage(language) || FALLBACK_LANGUAGE;
}

function getLeadEmailLanguage(lead) {
  return getEmailLanguage(
    lead?.language ||
      lead?.source?.context?.language ||
      lead?.source?.context?.cvLanguage
  );
}

function getPathValue(source, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, part) => {
      if (!current || typeof current !== "object") return undefined;
      return current[part];
    }, source);
}

function interpolate(value, variables = {}) {
  return String(value || "").replace(
    /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
    (match, key) =>
      Object.prototype.hasOwnProperty.call(variables, key)
        ? String(variables[key] ?? "")
        : match
  );
}

async function getEmailTranslationResources() {
  try {
    return await getRuntimeTranslationResources();
  } catch {
    return bundledTranslationResources;
  }
}

function createTranslator(resourceSet, language) {
  const emailLanguage = getEmailLanguage(language);
  const primary =
    resourceSet?.[emailLanguage]?.translation || {};
  const bundledPrimary =
    bundledTranslationResources[emailLanguage]?.translation || {};
  const fallback =
    resourceSet?.[FALLBACK_LANGUAGE]?.translation || {};
  const bundledFallback =
    bundledTranslationResources[FALLBACK_LANGUAGE]?.translation || {};

  return {
    language: emailLanguage,
    t(key, variables = {}, fallbackValue = "") {
      const value =
        getPathValue(primary, key) ??
        getPathValue(bundledPrimary, key) ??
        getPathValue(fallback, key) ??
        getPathValue(bundledFallback, key) ??
        fallbackValue;

      return typeof value === "string"
        ? interpolate(value, variables)
        : fallbackValue;
    },
  };
}

async function getEmailTranslator(language) {
  const resourceSet = await getEmailTranslationResources();
  return createTranslator(resourceSet, language);
}

function tEmail(translator, key, variables = {}, fallbackValue = "") {
  return translator.t(`email.${key}`, variables, fallbackValue);
}

function getDownloadLanguageLabel(translator, language) {
  const normalizedLanguage = cleanText(language).toLowerCase();
  if (!normalizedLanguage) {
    return tEmail(translator, "requesterCopy.cta", {}, "Download CV");
  }

  return tEmail(
    translator,
    `requesterCopy.downloadLanguages.${normalizedLanguage}`,
    {},
    normalizedLanguage.toUpperCase()
  );
}

function normalizeDownloadLinks(translator, downloadUrl, downloadLinks = []) {
  const links = Array.isArray(downloadLinks)
    ? downloadLinks
        .filter((link) => cleanText(link?.href))
        .map((link) => ({
          href: cleanText(link.href),
          label:
            cleanText(link.label) ||
            getDownloadLanguageLabel(translator, link.language),
          language: cleanText(link.language).toLowerCase(),
        }))
    : [];

  if (links.length > 0) return links;
  if (!downloadUrl) return [];

  return [
    {
      href: downloadUrl,
      label: tEmail(translator, "requesterCopy.cta", {}, "Download CV"),
      language: "",
    },
  ];
}

function getRequestVariant(lead) {
  return lead.source?.type === "cv_download" ? "cv" : "contact";
}

function getGreeting(lead, translator) {
  return cleanText(lead.name)
    ? tEmail(translator, "common.greetingNamed", {name: lead.name}, `Hi ${lead.name},`)
    : tEmail(translator, "common.greetingGeneric", {}, "Hi there,");
}

function getLocalizedRequestTypeLabel(value, translator) {
  return tEmail(
    translator,
    `common.requestTypes.${value}`,
    {},
    INTERNAL_REQUEST_TYPE_LABELS[value] || cleanText(value) || "General"
  );
}

function absoluteUrl(value, origin) {
  const url = cleanText(value);
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (!origin) return "";

  try {
    return new URL(url, origin).toString();
  } catch {
    return "";
  }
}

async function getEmailBrand(origin) {
  let metadata;

  try {
    metadata = await getSiteMetadata();
  } catch {
    metadata = getDefaultSiteMetadata();
  }

  return {
    description: metadata.description,
    logoUrl: absoluteUrl(metadata.logoUrl, origin),
    siteUrl: origin || process.env.NEXT_PUBLIC_SITE_URL || "",
    title:
      process.env.NEXT_PUBLIC_SITE_NAME ||
      metadata.title ||
      getDefaultSiteMetadata().title,
  };
}

function renderParagraphs(paragraphs = []) {
  return paragraphs
    .filter((paragraph) => cleanText(paragraph))
    .map(
      (paragraph) =>
        `<p style="margin:0 0 14px;color:${THEME.textSecondary};font-size:16px;line-height:1.62;">${htmlText(
          paragraph
        )}</p>`
    )
    .join("");
}

function renderCode(code, label = "Verification code") {
  if (!code) return "";

  return `
    <div style="margin:24px 0 10px;padding:18px;border:1px solid ${THEME.borderStrong};border-radius:8px;background:${THEME.surfaceMuted};text-align:center;">
      <div style="color:${THEME.textMuted};font-size:12px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;">${escapeHtml(
        label
      )}</div>
      <div style="margin-top:8px;color:${THEME.foreground};font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:6px;">${escapeHtml(
        code
      )}</div>
    </div>
  `;
}

function renderCtas(ctas = []) {
  const links = ctas.filter((cta) => cta?.href && cta?.label);
  if (links.length === 0) return "";

  return `
    <div style="margin:24px 0 6px;">
      ${links
        .map(
          (cta, index) => `
            <a href="${escapeHtml(
              cta.href
            )}" style="display:inline-block;margin:0 10px 10px 0;border:1px solid ${
              index === 0 ? THEME.accent : THEME.borderStrong
            };border-radius:8px;background:${
              index === 0 ? THEME.accent : THEME.surfaceMuted
            };color:${
              index === 0 ? THEME.accentContrast : THEME.foreground
            };font-size:15px;font-weight:800;line-height:1;text-decoration:none;padding:15px 18px;">${escapeHtml(
              cta.label
            )}</a>
          `
        )
        .join("")}
    </div>
  `;
}

function renderDetails(details = []) {
  const rows = details
    .filter((item) => cleanText(item?.value))
    .map(
      (item) => `
        <tr>
          <td style="padding:11px 0;border-bottom:1px solid ${THEME.border};color:${THEME.textMuted};font-size:12px;font-weight:800;text-transform:uppercase;vertical-align:top;width:34%;">${escapeHtml(
            item.label
          )}</td>
          <td style="padding:11px 0;border-bottom:1px solid ${THEME.border};color:${THEME.foreground};font-size:14px;line-height:1.5;vertical-align:top;">${htmlText(
            item.value
          )}</td>
        </tr>
      `
    )
    .join("");

  if (!rows) return "";

  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">
      ${rows}
    </table>
  `;
}

function renderSections(sections = []) {
  return sections
    .filter((section) => section && (section.content || section.details?.length))
    .map(
      (section) => `
        <div style="margin-top:24px;padding:18px;border:1px solid ${THEME.border};border-radius:8px;background:${THEME.surfaceMuted};">
          <h2 style="margin:0 0 10px;color:${THEME.foreground};font-size:16px;line-height:1.3;">${escapeHtml(
            section.title
          )}</h2>
          ${
            section.content
              ? `<div style="color:${THEME.textSecondary};font-size:14px;line-height:1.58;">${htmlText(
                  section.content
                )}</div>`
              : ""
          }
          ${section.details ? renderDetails(section.details) : ""}
        </div>
      `
    )
    .join("");
}

export async function renderBrandedEmail({
  language = FALLBACK_LANGUAGE,
  origin = "",
  preheader = "",
  eyebrow = "",
  title = "",
  paragraphs = [],
  code = "",
  codeLabel = "Verification code",
  cta = null,
  ctas = [],
  details = [],
  sections = [],
  footer = "",
}) {
  const brand = await getEmailBrand(origin);
  const htmlLanguage = getEmailLanguage(language);
  const logo = brand.logoUrl
    ? `<img src="${escapeHtml(
        brand.logoUrl
      )}" width="44" height="44" alt="${escapeHtml(
        brand.title
      )}" style="display:block;border-radius:8px;" />`
    : `<div style="width:44px;height:44px;border-radius:8px;background:${THEME.accent};color:${THEME.accentContrast};font-size:18px;font-weight:900;line-height:44px;text-align:center;">${escapeHtml(
        brand.title.charAt(0) || "K"
      )}</div>`;

  return `<!doctype html>
<html lang="${escapeHtml(htmlLanguage)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="supported-color-schemes" content="dark light" />
    <title>${escapeHtml(title || brand.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${THEME.background};font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${THEME.foreground};">
    <div style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0;color:transparent;">${escapeHtml(
      preheader
    )}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${THEME.background};">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border-collapse:collapse;">
            <tr>
              <td style="padding:0 0 16px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="width:54px;vertical-align:middle;">${logo}</td>
                    <td style="vertical-align:middle;">
                      <div style="color:${THEME.foreground};font-size:17px;font-weight:850;line-height:1.2;">${escapeHtml(
                        brand.title
                      )}</div>
                      <div style="margin-top:3px;color:${THEME.textMuted};font-size:13px;line-height:1.4;">${escapeHtml(
                        brand.description
                      )}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="border:1px solid ${THEME.borderStrong};border-radius:10px;background:${THEME.surface};box-shadow:0 20px 50px rgba(0,0,0,0.28);padding:28px;">
                ${
                  eyebrow
                    ? `<div style="margin:0 0 10px;color:${THEME.textMuted};font-size:12px;font-weight:900;letter-spacing:2px;text-transform:uppercase;">${escapeHtml(
                        eyebrow
                      )}</div>`
                    : ""
                }
                <h1 style="margin:0 0 16px;color:${THEME.foreground};font-size:28px;line-height:1.16;font-weight:850;">${escapeHtml(
                  title
                )}</h1>
                ${renderParagraphs(paragraphs)}
                ${renderCode(code, codeLabel)}
                ${renderCtas(ctas.length ? ctas : cta ? [cta] : [])}
                ${renderDetails(details)}
                ${renderSections(sections)}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 4px 0;color:${THEME.textMuted};font-size:12px;line-height:1.55;">
                ${htmlText(
                  footer ||
                    `This email was sent by ${brand.title}. If you did not request it, you can ignore it.`
                )}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function formatInternalRequestType(value) {
  return INTERNAL_REQUEST_TYPE_LABELS[value] || cleanText(value) || "General";
}

function internalLeadBaseDetails(lead, options = {}) {
  const fields = INTERNAL_EMAIL_COPY.fields;
  const isCvRequest = lead.source?.type === "cv_download";
  const sourceValue =
    INTERNAL_EMAIL_COPY.sources[lead.source?.type] ||
    lead.source?.label ||
    lead.source?.type;

  return [
    {label: fields.source, value: sourceValue},
    {
      label: fields.requestType,
      value: isCvRequest
        ? formatInternalRequestType(lead.requestType)
        : lead.requestType,
    },
    {label: fields.name, value: lead.name},
    {label: fields.email, value: lead.email},
    {label: fields.phone, value: lead.phone},
    options.includeMessage ? {label: fields.message, value: lead.message} : null,
  ].filter(Boolean);
}

function localizedLeadBaseDetails(lead, translator, options = {}) {
  const sourceType = lead.source?.type || "contact_form";
  const sourceValue = tEmail(
    translator,
    `common.sources.${sourceType}`,
    {},
    lead.source?.label || sourceType
  );

  return [
    {label: tEmail(translator, "common.fields.source", {}, "Source"), value: sourceValue},
    {
      label: tEmail(translator, "common.fields.requestType", {}, "Request type"),
      value: getLocalizedRequestTypeLabel(lead.requestType, translator),
    },
    {label: tEmail(translator, "common.fields.name", {}, "Name"), value: lead.name},
    {label: tEmail(translator, "common.fields.email", {}, "Email"), value: lead.email},
    {label: tEmail(translator, "common.fields.phone", {}, "Phone"), value: lead.phone},
    options.includeMessage
      ? {
          label: tEmail(translator, "common.fields.message", {}, "Message"),
          value: lead.message,
        }
      : null,
  ].filter(Boolean);
}

function requesterSummaryLines(lead, translator) {
  const isCvRequest = lead.source?.type === "cv_download";
  const fields = {
    name: tEmail(translator, "common.fields.name", {}, "Name"),
    email: tEmail(translator, "common.fields.email", {}, "Email"),
    phone: tEmail(translator, "common.fields.phone", {}, "Phone"),
    requestType: tEmail(
      translator,
      "common.fields.requestType",
      {},
      "Request type"
    ),
    message: tEmail(translator, "common.fields.message", {}, "Message"),
  };

  return [
    `${fields.name}: ${lead.name}`,
    `${fields.email}: ${lead.email}`,
    lead.phone ? `${fields.phone}: ${lead.phone}` : "",
    isCvRequest
      ? `${fields.requestType}: ${getLocalizedRequestTypeLabel(
          lead.requestType,
          translator
        )}`
      : "",
    lead.message ? `${fields.message}:\n${lead.message}` : "",
  ].filter(Boolean);
}

export async function getLeadVerificationEmailSubject(lead) {
  const translator = await getEmailTranslator(getLeadEmailLanguage(lead));
  const variant = getRequestVariant(lead);

  return tEmail(
    translator,
    `verification.subject.${variant}`,
    {},
    variant === "cv" ? "Verify your CV request" : "Verify your contact request"
  );
}

export async function getLeadVerificationEmailText({lead, verificationCode}) {
  const translator = await getEmailTranslator(getLeadEmailLanguage(lead));
  const variant = getRequestVariant(lead);

  return [
    getGreeting(lead, translator),
    "",
    tEmail(
      translator,
      `verification.instruction.${variant}`,
      {},
      variant === "cv"
        ? "Please confirm your email to access the CV download."
        : "Please confirm your email to send your message."
    ),
    "",
    `${tEmail(
      translator,
      "common.verificationCode",
      {},
      "Verification code"
    )}: ${verificationCode}`,
    "",
    tEmail(
      translator,
      "verification.footer",
      {},
      "This code confirms that the request came from your email address. If you did not request this, you can ignore this email."
    ),
  ].join("\n");
}

export async function getRequesterCopyEmailSubject(lead) {
  const translator = await getEmailTranslator(getLeadEmailLanguage(lead));
  const variant = getRequestVariant(lead);

  return tEmail(
    translator,
    `requesterCopy.subject.${variant}`,
    {},
    variant === "cv"
      ? "Copy of your CV access request"
      : "Copy of your contact request"
  );
}

export async function getRequesterCopyEmailText(
  lead,
  downloadUrl,
  downloadLinks = []
) {
  const translator = await getEmailTranslator(getLeadEmailLanguage(lead));
  const variant = getRequestVariant(lead);
  const normalizedDownloadLinks = normalizeDownloadLinks(
    translator,
    downloadUrl,
    downloadLinks
  );
  const downloadTextLines = normalizedDownloadLinks.length
    ? [
        "",
        `${tEmail(
          translator,
          "requesterCopy.downloadLabel",
          {},
          "CV downloads"
        )}:`,
        ...normalizedDownloadLinks.map((link) => `${link.label}: ${link.href}`),
      ]
    : [];

  return [
    getGreeting(lead, translator),
    "",
    tEmail(
      translator,
      `requesterCopy.confirmed.${variant}`,
      {},
      variant === "cv"
        ? "Your CV access request has been confirmed and received."
        : "Your contact request has been confirmed and received."
    ),
    tEmail(
      translator,
      `requesterCopy.nextStep.${variant}`,
      {},
      variant === "cv"
        ? "You can use the secure download link below. It is personal to your verified request."
        : "I will review your message and reply shortly."
    ),
    "",
    tEmail(
      translator,
      "requesterCopy.submittedDetails",
      {},
      "Here is a copy of the details you submitted:"
    ),
    "",
    ...requesterSummaryLines(lead, translator),
    ...downloadTextLines,
    "",
    tEmail(
      translator,
      `requesterCopy.footer.${variant}`,
      {},
      variant === "cv"
        ? "If anything needs to be corrected, please reply to this email."
        : "This is a copy of the details you submitted."
    ),
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export async function renderLeadVerificationEmail({
  lead,
  origin,
  verificationCode,
}) {
  const language = getLeadEmailLanguage(lead);
  const translator = await getEmailTranslator(language);
  const variant = getRequestVariant(lead);

  return renderBrandedEmail({
    language,
    origin,
    preheader: tEmail(
      translator,
      "verification.preheader",
      {code: verificationCode},
      `Verification code: ${verificationCode}`
    ),
    eyebrow: tEmail(translator, "verification.eyebrow", {}, "Verification"),
    title: tEmail(
      translator,
      `verification.title.${variant}`,
      {},
      variant === "cv"
        ? "Confirm your CV access request"
        : "Confirm your message"
    ),
    paragraphs: [
      getGreeting(lead, translator),
      tEmail(
        translator,
        `verification.instruction.${variant}`,
        {},
        variant === "cv"
          ? "Please confirm your email to access the CV download."
          : "Please confirm your email to send your message."
      ),
    ],
    code: verificationCode,
    codeLabel: tEmail(
      translator,
      "common.verificationCode",
      {},
      "Verification code"
    ),
    footer: tEmail(
      translator,
      "verification.footer",
      {},
      "This code confirms that the request came from your email address. If you did not request this, you can ignore this email."
    ),
  });
}

export async function renderOwnerLeadNotificationEmail({lead, origin}) {
  const tracking = lead.tracking || {};
  const isCvRequest = lead.source?.type === "cv_download";

  return renderBrandedEmail({
    origin,
    preheader: `${lead.name || "A lead"} submitted a ${
      isCvRequest ? "CV request" : "contact request"
    }.`,
    eyebrow: "New lead",
    title: isCvRequest
      ? `CV download request from ${lead.name}`
      : `New contact from ${lead.name}`,
    paragraphs: [
      "A verified lead was created from the website. Review the details below and manage the lead in the admin area.",
    ],
    cta: origin ? {href: `${origin}/admin/leads`, label: "Open leads"} : null,
    details: internalLeadBaseDetails(lead, {includeMessage: true}),
    sections: [
      {
        title: "Tracking",
        details: [
          {label: "IP", value: tracking.ip || "Unknown"},
          {label: "Country", value: tracking.country || "Unknown"},
          {label: "State", value: tracking.state || "Unknown"},
          {label: "Address", value: tracking.address || "Unknown"},
          {label: "Page", value: tracking.pageUrl || tracking.referrer || "Unknown"},
          {label: "User agent", value: tracking.userAgent || "Unknown"},
        ],
      },
    ],
  });
}

export async function renderRequesterCopyEmail({
  lead,
  origin,
  downloadUrl,
  downloadLinks = [],
}) {
  const language = getLeadEmailLanguage(lead);
  const translator = await getEmailTranslator(language);
  const variant = getRequestVariant(lead);
  const normalizedDownloadLinks = normalizeDownloadLinks(
    translator,
    downloadUrl,
    downloadLinks
  );

  return renderBrandedEmail({
    language,
    origin,
    preheader: tEmail(
      translator,
      `requesterCopy.preheader.${variant}`,
      {},
      variant === "cv"
        ? "Your CV access request has been confirmed."
        : "Your contact request has been confirmed."
    ),
    eyebrow: tEmail(translator, "requesterCopy.eyebrow", {}, "Request received"),
    title: tEmail(
      translator,
      `requesterCopy.title.${variant}`,
      {},
      variant === "cv"
        ? "Your CV access request is confirmed"
        : "Message received"
    ),
    paragraphs: [
      getGreeting(lead, translator),
      tEmail(
        translator,
        `requesterCopy.confirmed.${variant}`,
        {},
        variant === "cv"
          ? "Your CV access request has been confirmed and received."
          : "Your contact request has been confirmed and received."
      ),
      tEmail(
        translator,
        `requesterCopy.nextStep.${variant}`,
        {},
        variant === "cv"
          ? "You can use the secure download link below. It is personal to your verified request."
          : "I will review your message and reply shortly."
      ),
    ],
    ctas: normalizedDownloadLinks,
    details: localizedLeadBaseDetails(lead, translator, {includeMessage: true}),
    footer: tEmail(
      translator,
      `requesterCopy.footer.${variant}`,
      {},
      variant === "cv"
        ? "If anything needs to be corrected, please reply to this email."
        : "This is a copy of the details you submitted."
    ),
  });
}

export async function renderAdminCodeEmail({code, origin, siteHost}) {
  return renderBrandedEmail({
    origin,
    preheader: `Admin sign-in code: ${code}`,
    eyebrow: "Admin sign-in",
    title: "Your admin sign-in code",
    paragraphs: [
      `Use this code to complete sign-in to ${siteHost} admin.`,
      "This code expires in 10 minutes.",
    ],
    code,
    footer:
      "If you did not request this code, change your password immediately and review admin access.",
  });
}

export async function renderAdminMagicLinkEmail({
  link,
  origin,
  siteHost,
  intent = "sign_in",
}) {
  const isPasswordReset = intent === "password_reset";

  return renderBrandedEmail({
    origin,
    preheader: isPasswordReset
      ? `Reset your ${siteHost} admin password.`
      : `Sign in to ${siteHost} admin.`,
    eyebrow: isPasswordReset ? "Admin password reset" : "Admin sign-in",
    title: isPasswordReset
      ? "Reset your admin password"
      : "Your admin sign-in link",
    paragraphs: isPasswordReset
      ? [
          `Open this link to reset your ${siteHost} admin password.`,
          "This link expires in 15 minutes and can only be used once.",
        ]
      : [
          `Open this link to sign in to ${siteHost} admin.`,
          "This link expires in 15 minutes and can only be used once.",
        ],
    cta: {href: link, label: isPasswordReset ? "Reset password" : "Sign in"},
    details: [{label: "Fallback link", value: link}],
    footer: isPasswordReset
      ? "If you did not request this link, review admin access and ignore this email."
      : "If you did not request this link, change your password immediately and review admin access.",
  });
}
