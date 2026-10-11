import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLeadStatus} from "./leadStatuses.mjs";
import {followUpState, matchesLeadFilters, suggestedFollowUp} from "./leadOutreach.mjs";

test("pipeline stages survive serialization instead of collapsing to pending or lost", () => {
  for (const status of ["pending", "new", "contacted", "qualified", "meeting_scheduled", "proposal_sent", "negotiation", "on_hold", "won", "lost", "archived", "pending_verification"]) {
    assert.equal(normalizeLeadStatus(status), status);
  }
  assert.equal(normalizeLeadStatus(" contacted "), "contacted");
  assert.equal(normalizeLeadStatus(undefined), "pending");
  assert.equal(normalizeLeadStatus("invalid"), "pending");
});

test("open pipeline stages retain reminders and combine with status filters", () => {
  for (const status of ["new", "contacted", "qualified", "meeting_scheduled", "proposal_sent", "negotiation", "on_hold"]) {
    const lead = {status, name: "Ada", followUpOn: "2026-10-10", actions: [{occurredOn: "2026-10-08"}]};
    assert.equal(followUpState(lead, "2026-10-11"), "overdue");
    assert.equal(matchesLeadFilters(lead, {status, followUp: "due", search: "ada", today: "2026-10-11"}), true);
    assert.equal(matchesLeadFilters(lead, {status: "pending"}), false);
    assert.equal(suggestedFollowUp(lead), "2026-10-13");
  }
});

test("archived leads stay distinct from lost and do not produce reminders", () => {
  const lead = {status: normalizeLeadStatus("archived"), followUpOn: "2026-10-10", actions: [{occurredOn: "2026-10-08"}]};
  assert.equal(matchesLeadFilters(lead, {status: "archived"}), true);
  assert.equal(matchesLeadFilters(lead, {status: "lost"}), false);
  assert.equal(matchesLeadFilters(lead, {followUp: "due", today: "2026-10-11"}), false);
  assert.equal(suggestedFollowUp(lead), null);
});
