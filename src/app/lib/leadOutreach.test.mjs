import assert from "node:assert/strict";
import {test} from "node:test";
import {contactNames, normalizeContact, normalizeActivity, normalizeDay, addDays, followUpState, matchesLeadFilters, suggestedFollowUp} from "./leadOutreach.mjs";

const now = new Date("2026-10-10T12:00:00Z");

test("name-only contacts are valid, and profile URLs and emails are normalized", () => {
  assert.equal(normalizeContact({name: " Ada "}).name, "Ada");
  assert.equal(normalizeContact({name: "Ada"}).email, "");
  const contact = normalizeContact({name: "Ada", email: " ADA@example.com ", linkedinUrl: "https://de.linkedin.com/in/ada/?trk=search"});
  assert.equal(contact.email, "ada@example.com");
  assert.equal(contact.linkedinUrl, "https://www.linkedin.com/in/ada");
});

test("invalid contact links, credentials, and malformed contact data are rejected", () => {
  for (const contact of [null, [], {name: ""}, {name: "Ada", email: "a@example.com\nBcc: x"}, {name: "Ada", website: "javascript:alert(1)"}, {name: "Ada", detailsSource: "https://user:password@example.com"}, {name: "Ada", linkedinUrl: "https://linkedin.com.evil.test/in/ada"}, {name: "Ada", linkedinUrl: "https://www.linkedin.com/company/example"}]) {
    assert.throws(() => normalizeContact(contact));
  }
});

test("activities keep their actual date independently from the recording time", () => {
  const activity = normalizeActivity({type: "connection_requested", channel: "linkedin", occurredOn: "2026-10-08"}, now);
  assert.equal(activity.occurredOn, "2026-10-08");
  assert.equal(activity.text, "Connection request sent");
  assert.equal(activity.channel, "linkedin");
});

test("invalid activities cannot silently become notes or planned outreach", () => {
  for (const patch of [{type: "unknown"}, {channel: "unknown"}, {occurredOn: "2026-10-12"}, {occurredOn: "2026-02-30"}, {occurredOn: ""}, {type: "note", text: ""}]) {
    assert.throws(() => normalizeActivity({type: "message_sent", channel: "linkedin", occurredOn: "2026-10-10", ...patch}, now));
  }
});

test("calendar follow-ups survive month/year boundaries, leap years, and DST", () => {
  assert.equal(addDays("2026-10-08"), "2026-10-13");
  assert.equal(addDays("2026-12-29"), "2027-01-03");
  assert.equal(addDays("2028-02-25"), "2028-03-01");
  assert.equal(addDays("2026-10-23"), "2026-10-28");
  assert.equal(normalizeDay(null), null);
  for (const date of ["2026-02-29", "2026-13-01", "10/10/2026", {}, "2026-10-10T00:00:00Z"]) assert.throws(() => normalizeDay(date));
});

test("follow-up states distinguish due today, overdue, future, unscheduled, and closed", () => {
  const lead = {status: "pending"};
  const today = "2026-10-10";
  assert.equal(followUpState(lead, today), "unscheduled");
  assert.equal(followUpState({...lead, followUpOn: "2026-10-09"}, today), "overdue");
  assert.equal(followUpState({...lead, followUpOn: today}, today), "today");
  assert.equal(followUpState({...lead, followUpOn: "2026-10-11"}, today), "upcoming");
  for (const status of ["won", "lost", "archived"]) assert.equal(followUpState({status, followUpOn: "2026-10-09"}, today), "closed");
});

test("a rescheduled or closed lead leaves the due view; filters combine with search", () => {
  const lead = {status: "pending", name: "Ada", company: "Example", source: {type: "manual"}, followUpOn: "2026-10-08"};
  const filter = {followUp: "due", today: "2026-10-10", search: "EXAMPLE", source: "manual"};
  assert.equal(matchesLeadFilters(lead, filter), true);
  assert.equal(matchesLeadFilters({...lead, followUpOn: "2026-10-15"}, filter), false);
  assert.equal(matchesLeadFilters({...lead, status: "won"}, filter), false);
  assert.equal(matchesLeadFilters(lead, {...filter, source: "cv_download"}), false);
});

test("follow-up suggestions use the latest activity, including backdated entries", () => {
  const lead = {status: "pending", actions: [{occurredOn: "2026-10-10"}, {occurredOn: "2026-10-01"}]};
  assert.equal(suggestedFollowUp(lead, {occurredOn: "2026-10-03"}), "2026-10-15");
  assert.equal(suggestedFollowUp(lead, {occurredOn: "2026-10-12"}), "2026-10-17");
  assert.equal(suggestedFollowUp({status: "won", actions: lead.actions}), null);
  assert.equal(suggestedFollowUp({actions: []}), null);
  assert.equal(suggestedFollowUp({actions: [{createdAt: "2026-10-08T13:00:00Z"}]}), "2026-10-13");
});

test("manual contact locations survive normalization", () => {
  assert.equal(normalizeContact({name: "Ada", location: " Berlin, Germany "}).location, "Berlin, Germany");
});

test("first and last names are stored separately with a compatible display name", () => {
  const contact = normalizeContact({firstName: " Ada ", lastName: " van Example "});
  assert.equal(contact.firstName, "Ada");
  assert.equal(contact.lastName, "van Example");
  assert.equal(contact.name, "Ada van Example");
  assert.equal(normalizeContact({firstName: "Ada"}).name, "Ada");
  assert.equal(normalizeContact({lastName: "Example"}).name, "Example");
});

test("legacy full names remain editable without dropping surname components", () => {
  assert.deepEqual(contactNames({name: "Ada van Example"}), {firstName: "Ada", lastName: "van Example", name: "Ada van Example"});
  assert.equal(normalizeContact({name: "Ada"}).firstName, "Ada");
  assert.equal(normalizeContact({name: "Old Name", firstName: "New", lastName: "Name"}).name, "New Name");
  assert.throws(() => normalizeContact({name: "Old Name", firstName: "", lastName: ""}), /name is required/);
});
