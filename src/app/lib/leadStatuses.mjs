// Shared by the forms, filters, and server validation so stages survive saving.
export const LEAD_STATUS_OPTIONS = [
  {value: "pending", label: "Pending"},
  {value: "new", label: "New"},
  {value: "contacted", label: "Contacted"},
  {value: "qualified", label: "Qualified"},
  {value: "meeting_scheduled", label: "Meeting scheduled"},
  {value: "proposal_sent", label: "Proposal sent"},
  {value: "negotiation", label: "Negotiation"},
  {value: "on_hold", label: "On hold"},
  {value: "won", label: "Won"},
  {value: "lost", label: "Lost"},
  {value: "archived", label: "Archived"},
  {value: "pending_verification", label: "Pending verification"},
];

export const LEAD_STATUSES = LEAD_STATUS_OPTIONS.map(({value}) => value);
export const CLOSED_STATUSES = ["won", "lost", "archived"];

export function normalizeLeadStatus(value) {
  const status = String(value || "").trim();
  return LEAD_STATUSES.includes(status) ? status : "pending";
}
