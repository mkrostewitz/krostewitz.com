import test from "node:test";
import assert from "node:assert/strict";
import {groupLeadsByCompany, leadCompanySuggestions, companyKey, companyDetails, mergeCompanyDetails} from "./leadCompanies.mjs";

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

test('company keys normalize casing, spacing and Unicode', () => {
  assert.equal(companyKey('  ＡＣＭＥ   GmbH '), companyKey('Acme GmbH'));
});

test('saving an older form preserves unedited shared values and applies explicit clears', () => {
  const baseline = {website: 'https://old.example.com', products: ['Old'], address: {city: 'Berlin'}};
  const latest = companyDetails({...baseline, website: 'https://new.example.com', address: {city: 'Hamburg'}});
  const merged = mergeCompanyDetails(latest, {...baseline, products: []}, baseline);
  assert.equal(merged.website, latest.website);
  assert.equal(merged.address.city, 'Hamburg');
  assert.deepEqual(merged.products, []);
  assert.deepEqual(mergeCompanyDetails(latest, {}, null), latest);
});

test('legacy locations survive inheritance and explicit address clearing wins', () => {
  assert.deepEqual(companyDetails({location: 'Berlin'}).address, null);
  assert.equal(companyDetails({location: 'Berlin'}).location, 'Berlin');
  assert.equal(companyDetails({address: {}, location: 'Berlin'}).location, '');
});
