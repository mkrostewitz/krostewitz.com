import {normalizeAddress, formatAddress} from "./leadAddress.mjs";

export const ACTIVITY_TYPES = {
  note: "Note",
  followed: "Followed on LinkedIn",
  connection_requested: "Connection request sent",
  connection_accepted: "Connection accepted",
  message_sent: "Message sent",
  email_sent: "Email sent",
  follow_up: "Follow-up sent",
  reply_received: "Reply received",
  call: "Call",
  meeting: "Meeting",
};
export const CHANNELS = {linkedin: "LinkedIn", email: "Email", phone: "Phone", other: "Other"};
export const CONTACT_FIELDS = ["firstName", "lastName", "company", "role", "location", "email", "phone", "linkedinUrl", "website", "detailsSource"];
export const CLOSED_STATUSES = ["won", "lost", "archived"];

export class OutreachValidationError extends Error {
  constructor(message) { super(message); this.name = "OutreachValidationError"; this.status = 400; }
}
const clean = (value, max = 200) => String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);

// Existing full names are a best-effort starting point; explicit fields take precedence.
export function contactNames(input = {}) {
  let firstName;
  let lastName;
  if (Object.hasOwn(input, "firstName") || Object.hasOwn(input, "lastName")) {
    firstName = clean(input.firstName);
    lastName = clean(input.lastName);
  } else {
    const parts = clean(input.name).split(/\s+/);
    firstName = parts.shift() || "";
    lastName = parts.join(" ");
  }
  return {firstName, lastName, name: [firstName, lastName].filter(Boolean).join(" ")};
}

export function normalizeContact(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OutreachValidationError("Enter valid contact details.");
  const contact = Object.fromEntries(CONTACT_FIELDS.map((key) => [key, clean(input[key], key.endsWith("Url") || ["website", "detailsSource"].includes(key) ? 2000 : 200)]));
  Object.assign(contact, contactNames(input));
  if (Object.hasOwn(input, "address")) {
    try { contact.address = normalizeAddress(input.address); }
    catch (error) { throw new OutreachValidationError(error.message); }
    contact.location = formatAddress(contact.address);
  }
  if (!contact.name) throw new OutreachValidationError("Contact name is required.");
  contact.email = contact.email.toLowerCase();
  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new OutreachValidationError("Enter a valid email address or leave it empty.");
  if (contact.phone && !/^\+?[\d\s()./-]{5,40}$/.test(contact.phone)) throw new OutreachValidationError("Enter a valid phone number or leave it empty.");
  for (const key of ["linkedinUrl", "website", "detailsSource"]) {
    if (!contact[key]) continue;
    let url;
    try { url = new URL(contact[key]); } catch { throw new OutreachValidationError(`Enter a complete https:// URL for ${key}.`); }
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) throw new OutreachValidationError("Contact links must be HTTP or HTTPS URLs.");
    if (key === "linkedinUrl") {
      if (!(url.hostname === "linkedin.com" || url.hostname.endsWith(".linkedin.com")) || !/^\/in\/[^/]+\/?$/.test(url.pathname)) throw new OutreachValidationError("Enter a LinkedIn personal profile URL (linkedin.com/in/…).");
      contact[key] = `https://www.linkedin.com${url.pathname.replace(/\/$/, "")}`;
    } else contact[key] = url.href;
  }
  return contact;
}

export function normalizeDay(value, label = "Date") {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new OutreachValidationError(`${label} must be a valid date.`);
  const date = new Date(`${value}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new OutreachValidationError(`${label} must be a valid date.`);
  return value;
}

// Calendar dates avoid shifting a reminder to the previous day across timezones.
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(day, count = 5) {
  normalizeDay(day);
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}
export function followUpState(lead, today = localDay()) {
  if (CLOSED_STATUSES.includes(lead.status)) return "closed";
  if (!lead.followUpOn) return "unscheduled";
  return lead.followUpOn < today ? "overdue" : lead.followUpOn === today ? "today" : "upcoming";
}
export function normalizeActivity(input = {}, now = new Date()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new OutreachValidationError("Enter a valid activity.");
  const type = clean(input.type || "note", 40);
  const channel = clean(input.channel || "other", 40);
  if (!Object.hasOwn(ACTIVITY_TYPES, type)) throw new OutreachValidationError("Choose a valid activity type.");
  if (!Object.hasOwn(CHANNELS, channel)) throw new OutreachValidationError("Choose a valid channel.");
  const occurredOn = normalizeDay(input.occurredOn, "Activity date");
  if (!occurredOn) throw new OutreachValidationError("Activity date is required.");
  // Allow today's date in every timezone, while rejecting future scheduled activities.
  if (occurredOn > new Date(now.getTime() + 14 * 3600000).toISOString().slice(0, 10)) throw new OutreachValidationError("Activity date cannot be in the future. Use the follow-up date to plan ahead.");
  const text = clean(input.text, 4000) || (type === "note" ? "" : ACTIVITY_TYPES[type]);
  if (!text) throw new OutreachValidationError("Enter a note or choose an outreach activity.");
  return {type, channel, occurredOn, text};
}

export function matchesLeadFilters(lead, {status = "", source = "", search = "", followUp = "", today = localDay()} = {}) {
  const query = search.trim().toLowerCase();
  return (!status || lead.status === status) &&
    (!source || lead.source?.type === source) &&
    (!query || [lead.name, lead.company, lead.role, lead.email, lead.phone].some((value) => String(value || "").toLowerCase().includes(query))) &&
    (!followUp || (followUp === "due"
      ? ["overdue", "today"].includes(followUpState(lead, today))
      : followUpState(lead, today) === followUp));
}

export function suggestedFollowUp(lead, activity) {
  if (CLOSED_STATUSES.includes(lead?.status)) return null;
  const dates = [...(lead?.actions || []), ...(activity ? [activity] : [])]
    .map((item) => item.occurredOn || item.createdAt?.slice(0, 10))
    .filter(Boolean).sort();
  return dates.length ? addDays(dates.at(-1), 5) : null;
}
