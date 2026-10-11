import test from "node:test";
import assert from "node:assert/strict";
import {groupLeadsByCompany, leadCompanySuggestions} from "./leadCompanies.mjs";

test("company groups ignore casing and spacing, retaining the supplied follow-up order", () => {
  const leads = [
    {id: "due", company: "  Example   GmbH "},
    {id: "other", company: "Acme"},
    {id: "later", company: "example gmbh"},
    {id: "missing"},
    {id: "empty", company: " "},
  ];
  const groups = groupLeadsByCompany(leads);
  assert.deepEqual(groups.map((group) => group.name), ["Acme", "Example GmbH", ""]);
  assert.deepEqual(groups[1].leads.map((lead) => lead.id), ["due", "later"]);
  assert.deepEqual(groups[2].leads.map((lead) => lead.id), ["missing", "empty"]);
  assert.equal(leads[0].company, "  Example   GmbH ");
});

test("suggestions include unique company names only, without changing existing contacts", () => {
  assert.deepEqual(leadCompanySuggestions([
    {company: "Acme"}, {company: "ACME"}, {company: "Acme UK"}, {company: ""}, {},
  ]), ["Acme", "Acme UK"]);
  assert.deepEqual(leadCompanySuggestions([]), []);
  assert.deepEqual(groupLeadsByCompany([{company: "No company"}, {}]).map((group) => group.key), ["no company", ""]);
});
