import test from "node:test";
import assert from "node:assert/strict";
import {sendLeadToApollo} from "./apolloOutreach.mjs";
import {apolloSettingsPatch, apolloSettingsStatus} from "./apolloSettingsCore.mjs";

const id = "507f1f77bcf86cd799439011";
const contact = {firstName: "Max", lastName: "Example", company: "Example", email: "max@example.com"};
const settings = {available: true, listEnabled: true, sequenceEnabled: true, sequenceId: "507f1f77bcf86cd799439012", emailAccountId: "507f1f77bcf86cd799439013"};
const list = {labels: [{name: "website_leads"}]};
function mock(responses, calls) {
  return async (url, options) => {
    calls.push({url, method: options.method, body: JSON.parse(options.body)});
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return {ok: true, json: async () => next};
  };
}

test("list action deduplicates contacts and does not enroll without per-contact opt-in", async () => {
  for (const key of ["created_contacts", "existing_contacts"]) {
    const calls = [];
    const result = await sendLeadToApollo({contact, settings, apiKey: "test", fetchImpl: mock([{[key]: [{id, email: contact.email}]}, ...(key === "existing_contacts" ? [{contact: {id}}] : []), list], calls)});
    assert.equal(result.listAdded, true);
    assert.equal(result.sequenceStatus, "not_requested");
    assert.equal(calls.length, key === "existing_contacts" ? 3 : 2);
    assert.equal(calls[0].body.run_dedupe, true);
    assert.deepEqual(calls.at(-1).body, {entity_ids: [id], label_names: ["website_leads"], modality: "contacts", async: false});
  }
});

test("enrollment targets only the selected contact and keeps Apollo safeguards", async () => {
  const calls = [];
  const result = await sendLeadToApollo({contact, settings, enroll: true, apiKey: "test", fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, list, {contacts: [{id}]}], calls)});
  assert.equal(result.sequenceStatus, "enrolled");
  const request = calls[2];
  assert.ok(request.url.includes(settings.sequenceId));
  assert.deepEqual(request.body.contact_ids, [id]);
  assert.equal(request.body.send_email_from_email_account_id, settings.emailAccountId);
  assert.equal(request.body.sequence_unverified_email, false);
  assert.equal(request.body.sequence_active_in_other_campaigns, false);
  assert.equal(request.body.contact_verification_skipped, false);
  assert.equal(request.body.label_names, undefined);
});

test("disabled or unconfigured actions and email-less enrollment cannot make requests", async () => {
  const fetchImpl = async () => assert.fail("Must not call Apollo");
  for (const invalid of [{...settings, available: false}, {...settings, listEnabled: false}]) {
    await assert.rejects(sendLeadToApollo({contact, settings: invalid, fetchImpl}), {status: 403});
  }
  await assert.rejects(sendLeadToApollo({contact, settings: {...settings, sequenceEnabled: false}, enroll: true, fetchImpl}), {status: 403});
  await assert.rejects(sendLeadToApollo({contact: {...contact, email: ""}, settings, enroll: true, fetchImpl}), {status: 400});
});

test("partial failures and skipped enrollment never claim successful enrollment", async () => {
  for (const [response, expected] of [[{skipped_contact_ids: {[id]: "contacts_already_exists_in_current_campaign"}}, "already_enrolled"], [{skipped_contact_ids: {[id]: "contacts_unverified_email"}}, "skipped"], [{}, "unknown"], [new Error("network"), "unknown"]]) {
    const result = await sendLeadToApollo({contact, settings, enroll: true, apiKey: "test", fetchImpl: mock([{existing_contacts: [{id, email: contact.email}]}, {contact: {id}}, list, response], [])});
    assert.equal(result.listAdded, true);
    assert.equal(result.sequenceStatus, expected);
    assert.match(result.message, /website_leads/);
  }
  const calls = [];
  const result = await sendLeadToApollo({contact, settings, enroll: true, apiKey: "test", fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, {message: "No Models or Lists provided"}], calls)});
  assert.equal(result.listAdded, false);
  assert.equal(calls.length, 2);
});

test("a deduplicated contact with a different email is never added or enrolled", async () => {
  const calls = [];
  const result = await sendLeadToApollo({contact, settings, enroll: true, apiKey: "test", fetchImpl: mock([{existing_contacts: [{id, email: "someone-else@example.com"}]}], calls)});
  assert.equal(calls.length, 1);
  assert.equal(result.listAdded, false);
});

test("optional settings default off and validate IDs without changing stored keys", () => {
  assert.equal(apolloSettingsStatus({}).listEnabled, false);
  assert.equal(apolloSettingsStatus({}).sequenceEnabled, false);
  const patch = apolloSettingsPatch({enabled: true, listEnabled: true, sequenceEnabled: true, sequenceId: settings.sequenceId, emailAccountId: settings.emailAccountId});
  assert.equal(patch.apiKeyEncrypted, undefined);
  assert.equal(patch.sequenceId, settings.sequenceId);
  assert.throws(() => apolloSettingsPatch({enabled: true, sequenceId: "../other"}));
  assert.throws(() => apolloSettingsPatch({enabled: true, listEnabled: "true"}));
});

test("selected list is resolved by ID so renames target the current list", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    if (options.method === "GET") return {ok: true, json: async () => [{id, name: "New list name", modality: "contacts"}]};
    return mock([{created_contacts: [{id, email: contact.email}]}, {labels: [{name: "New list name"}, {name: "Recruiter"}]}].slice(calls.length), calls)(url, options);
  };
  const result = await sendLeadToApollo({contact, settings: {...settings, listId: id, listName: "Old name"}, categories: ["Recruiter"], fetchImpl});
  assert.equal(result.listAdded, true);
  assert.deepEqual(calls[1].body.label_names, ["New list name", "Recruiter"]);
  assert.match(result.message, /New list name/);
});

test("deleted selected lists stop before contact creation", async () => {
  await assert.rejects(sendLeadToApollo({contact, settings: {...settings, listId: id}, fetchImpl: async (url, options) => {
    assert.equal(options.method, "GET");
    return {ok: true, json: async () => []};
  }}), /no longer available/);
});

test("permission failures identify the failed action and required endpoint", async () => {
  const result = await sendLeadToApollo({contact, settings, fetchImpl: async () => ({ok: false, status: 403})});
  assert.equal(result.listAdded, false);
  assert.match(result.message, /contact creation.*api\/v1\/contacts\/bulk_create/);
});


test("linked contact updates full details by ID after email changes without recreating or enrolling", async () => {
  const calls = [];
  const full = {...contact, email: "changed@example.com", phone: "+49307654321", role: "Director", website: "https://example.com/", location: "Berlin, Germany"};
  const result = await sendLeadToApollo({contact: full, contactId: id, categories: ["Recruiter"], settings,
    onContactLinked: async (linked) => {assert.equal(linked, id); calls.push({linked});},
    fetchImpl: mock([{contact: {id}}, {labels: [{name: "website_leads"}, {name: "Recruiter"}]}], calls)});
  assert.equal(result.detailsUpdated, true);
  assert.equal(result.labelsAdded, true);
  assert.equal(calls[1].method, "PATCH");
  assert.ok(calls[1].url.endsWith(`/contacts/${id}`));
  assert.deepEqual(calls[1].body, {first_name: "Max", last_name: "Example", email: full.email, organization_name: "Example", title: "Director", website_url: full.website, direct_phone: full.phone, present_raw_address: full.location, linkedin_url: ""});
  assert.deepEqual(calls[2].body.label_names, ["website_leads", "Recruiter"]);
  assert.equal(result.sequenceStatus, "not_requested");
});

test("link persists before update failure and failure never claims successful sync", async () => {
  let linked;
  const calls = [];
  const result = await sendLeadToApollo({contact, settings, onContactLinked: async (value) => {linked = value;},
    fetchImpl: mock([{existing_contacts: [{id, email: contact.email}]}, new Error("offline")], calls)});
  assert.equal(linked, id);
  assert.equal(result.contactId, id);
  assert.equal(result.detailsUpdated, false);
  assert.equal(result.labelsAdded, false);
  assert.equal(calls.length, 2);
});

test("new contacts include phone, company, title, website and location", async () => {
  const calls = [];
  await sendLeadToApollo({contact: {...contact, phone: "+49307654321", role: "CEO", website: "https://example.com/", location: "Berlin"}, settings,
    fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, list], calls)});
  const fields = calls[0].body.contacts[0];
  assert.equal(fields.direct_phone, "+49307654321");
  assert.equal(fields.organization_name, "Example");
  assert.equal(fields.title, "CEO");
  assert.equal(fields.website_url, "https://example.com/");
  assert.equal(fields.present_raw_address, "Berlin");
});

test("tag assignment timeouts are identified as retryable without losing contact identity", async () => {
  const result = await sendLeadToApollo({contact, settings, contactId: id, fetchImpl: async (url) => {
    if (url.includes("labels/")) throw new DOMException("Timed out", "TimeoutError");
    return {ok: true, json: async () => ({contact: {id}})};
  }});
  assert.equal(result.contactId, id);
  assert.equal(result.detailsUpdated, true);
  assert.equal(result.labelsAdded, false);
  assert.equal(result.retryable, true);
  assert.equal(result.errorCode, "timeout");
  assert.match(result.message, /list\/tag assignment timed out/);
});

test("rate limits and server errors retry; invalid permissions and data do not", async () => {
  for (const status of [400, 401, 403, 422, 429, 500, 503]) {
    const result = await sendLeadToApollo({contact, settings, contactId: id, fetchImpl: async () => ({ok: false, status})});
    assert.equal(result.retryable, status === 429 || status >= 500);
  }
});

test("Source updates and clears via the custom field ID before enrollment", async () => {
  const sourceFieldId = "507f1f77bcf86cd799439099";
  for (const source of ["LinkedIn", ""]) {
    const calls = [];
    const result = await sendLeadToApollo({contact: {...contact, source}, contactId: id, sourceFieldId, settings,
      fetchImpl: mock([{contact: {id, typed_custom_fields: {[sourceFieldId]: source}}}, list], calls)});
    assert.deepEqual(calls[0].body.typed_custom_fields, {[sourceFieldId]: source});
    assert.equal(result.detailsUpdated, true);
  }
  const result = await sendLeadToApollo({contact: {...contact, source: "LinkedIn"}, contactId: id, sourceFieldId, settings, enroll: true,
    fetchImpl: mock([{contact: {id, typed_custom_fields: {}}}], [])});
  assert.equal(result.detailsUpdated, false);
  assert.equal(result.sequenceStatus, "not_requested");
  assert.match(result.message, /did not confirm the Source/);
});

test("new Apollo contacts receive a verified Source update after identity is linked", async () => {
  const sourceFieldId = "507f1f77bcf86cd799439099";
  const calls = [];
  const result = await sendLeadToApollo({contact: {...contact, source: "Conference"}, sourceFieldId, settings,
    fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, {contact: {id, typed_custom_fields: {[sourceFieldId]: "Conference"}}}, list], calls)});
  assert.equal(calls[1].method, "PATCH");
  assert.equal(result.detailsUpdated, true);
});

test("Contact Type replaces all tags, clears removed tags, and adds only the destination list", async () => {
  const tagsFieldId = "507f1f77bcf86cd799439088";
  for (const categories of [["Recruiter", "Interim Firm", "recruiter"], ["Manufacturer"], []]) {
    const value = [...new Map(categories.map((tag) => [tag.toLowerCase(), tag])).keys()].map((key) => categories.find((tag) => tag.toLowerCase() === key)).join("; ");
    const calls = [];
    const result = await sendLeadToApollo({contact, contactId: id, tagsFieldId, categories, settings,
      fetchImpl: mock([{contact: {id, typed_custom_fields: {[tagsFieldId]: value}}}, list], calls)});
    assert.equal(result.detailsUpdated, true);
    assert.equal(calls[0].body.typed_custom_fields[tagsFieldId], value);
    assert.deepEqual(calls[1].body.label_names, ["website_leads"]);
  }
});

test("Contact Type and Source coexist and an unconfirmed tag update blocks enrollment", async () => {
  const tagsFieldId = "507f1f77bcf86cd799439088", sourceFieldId = "507f1f77bcf86cd799439099";
  const calls = [];
  const fields = {[tagsFieldId]: "Recruiter", [sourceFieldId]: "LinkedIn"};
  const result = await sendLeadToApollo({contact: {...contact, source: "LinkedIn"}, contactId: id, tagsFieldId, sourceFieldId, categories: ["Recruiter"], settings,
    fetchImpl: mock([{contact: {id, typed_custom_fields: fields}}, list], calls)});
  assert.equal(result.detailsUpdated, true);
  assert.deepEqual(calls[0].body.typed_custom_fields, fields);
  const failed = await sendLeadToApollo({contact, contactId: id, tagsFieldId, categories: ["Recruiter"], enroll: true, settings,
    fetchImpl: mock([{contact: {id, typed_custom_fields: {}}}], [])});
  assert.equal(failed.detailsUpdated, false);
  assert.equal(failed.sequenceStatus, "not_requested");
});

test("company products and applications sync together, including clearing and new contacts", async () => {
  const companyFieldIds = {products: "507f1f77bcf86cd799439077", applications: "507f1f77bcf86cd799439066"};
  for (const empty of [false, true]) {
    const company = {...contact, products: empty ? [] : ["Sensors", "sensors", "Software"], applications: empty ? [] : ["Factory automation", "Quality control"]};
    const expected = {[companyFieldIds.products]: empty ? "" : "Sensors, Software", [companyFieldIds.applications]: empty ? "" : "Factory automation, Quality control"};
    const calls = [];
    const result = await sendLeadToApollo({contact: company, companyFieldIds, settings,
      fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, {contact: {id, typed_custom_fields: expected}}, list], calls)});
    assert.equal(result.detailsUpdated, true);
    assert.deepEqual(calls[1].body.typed_custom_fields, expected);
    assert.equal(calls[1].method, "PATCH");
  }
});

test("company fields must be configured and confirmed before starting a sequence", async () => {
  const company = {...contact, applications: ["Automation"]};
  await assert.rejects(sendLeadToApollo({contact: company, settings, fetchImpl: () => assert.fail("Do not send")}), /not configured/);
  const result = await sendLeadToApollo({contact: company, contactId: id, companyFieldIds: {applications: "507f1f77bcf86cd799439066"}, settings, enroll: true,
    fetchImpl: mock([{contact: {id, typed_custom_fields: {}}}], [])});
  assert.equal(result.detailsUpdated, false);
  assert.equal(result.sequenceStatus, "not_requested");
});

test("custom sequences override routing and work without a configured fallback", async () => {
  const sequenceId = "507f1f77bcf86cd799439099";
  for (const sequenceSettings of [settings, {...settings, sequenceId: "", sequenceRules: []}]) {
    const calls = [];
    const result = await sendLeadToApollo({contact, settings: sequenceSettings, sequenceId, enroll: true,
      fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, list, {contacts: [{id}]}], calls)});
    assert.equal(result.sequenceStatus, "enrolled");
    assert.equal(result.sequenceId, sequenceId);
    assert.ok(calls[2].url.includes(`/${sequenceId}/`));
    assert.equal(calls[2].body.emailer_campaign_id, sequenceId);
  }
});

test("custom selections still require opt-in and enabled enrollment", async () => {
  const sequenceId = "507f1f77bcf86cd799439099";
  const calls = [];
  const result = await sendLeadToApollo({contact, settings, sequenceId,
    fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, list], calls)});
  assert.equal(result.sequenceStatus, "not_requested");
  assert.equal(calls.length, 2);
  await assert.rejects(sendLeadToApollo({contact, settings: {...settings, sequenceEnabled: false}, sequenceId, enroll: true,
    fetchImpl: async () => assert.fail("Must not call Apollo")}), {status: 403});
  for (const invalid of ["../sequence", {}, 123]) {
    await assert.rejects(sendLeadToApollo({contact, settings, sequenceId: invalid, enroll: true,
      fetchImpl: async () => assert.fail("Must not call Apollo")}), {status: 400});
  }
});


test("a custom sequence replaces the matching category and fallback for this action", async () => {
  const sequenceId = "507f1f77bcf86cd799439099";
  const calls = [];
  await sendLeadToApollo({contact, settings: {...settings, sequenceRules: [{category: "Manufacturer", sequenceId: "507f1f77bcf86cd799439088"}]},
    categories: ["Manufacturer"], sequenceId, enroll: true,
    fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, {labels: [{name: "website_leads"}, {name: "Manufacturer"}]}, {contacts: [{id}]}], calls)});
  const enrollments = calls.filter(call => call.url.includes("/emailer_campaigns/"));
  assert.equal(enrollments.length, 1);
  assert.equal(enrollments[0].body.emailer_campaign_id, sequenceId);
});

test("enrollment pins configured mailbox and address and flags a mismatched existing sender", async () => {
  const sendingAccount = {id: settings.emailAccountId, email: "chosen@example.com"};
  const calls = [];
  const result = await sendLeadToApollo({contact, settings, sendingAccount, enroll: true,
    fetchImpl: mock([{created_contacts: [{id, email: contact.email}]}, list, {
      skipped_contact_ids: {[id]: "contacts_already_exists_in_current_campaign"},
      contacts: [{id, contact_campaign_statuses: [{emailer_campaign_id: settings.sequenceId, send_email_from_email_account_id: "507f1f77bcf86cd799439099"}]}],
    }], calls)});
  assert.equal(calls[2].body.send_email_from_email_account_id, settings.emailAccountId);
  assert.equal(calls[2].body.send_email_from_email_address, sendingAccount.email);
  assert.equal(result.senderStatus, "mismatch");
  assert.match(result.message, /different sending account/);
  await assert.rejects(sendLeadToApollo({contact, settings, sendingAccount: {...sendingAccount, id}, enroll: true,
    fetchImpl: async () => assert.fail("Must not write with a mismatched mailbox")}), /Sending account changed/);
});

test('salutation custom field syncs and clears, and must be confirmed before enrollment', async () => {
  const salutationFieldId = '507f1f77bcf86cd799439055';
  for (const salutation of ['Dr.', '']) {
    const calls = [];
    const result = await sendLeadToApollo({contact: {...contact, salutation}, contactId: id, salutationFieldId, settings,
      fetchImpl: mock([{contact: {id, typed_custom_fields: {[salutationFieldId]: salutation}}}, list], calls)});
    assert.equal(result.detailsUpdated, true);
    assert.equal(calls[0].body.typed_custom_fields[salutationFieldId], salutation);
  }
  const calls = [];
  const result = await sendLeadToApollo({contact: {...contact, salutation: 'Dr.'}, contactId: id, salutationFieldId, settings, enroll: true,
    fetchImpl: mock([{contact: {id, typed_custom_fields: {}}}], calls)});
  assert.equal(result.detailsUpdated, false);
  assert.equal(calls.length, 1);
  assert.match(result.message, /custom field value/);
});

test('email-less sync can update a linked contact without clearing its remote email; enrollment still needs email', async () => {
  const calls = [];
  const result = await sendLeadToApollo({contact: {...contact, email: ''}, contactId: id, settings, fetchImpl: mock([{contact: {id}}, list], calls)});
  assert.equal(result.detailsUpdated, true);
  assert.equal(Object.hasOwn(calls[0].body, 'email'), false);
  await assert.rejects(sendLeadToApollo({contact: {...contact, email: ''}, contactId: id, settings, enroll: true, fetchImpl: () => assert.fail('Must not call Apollo')}), /Add an email/);
});
test('email-less creation links only an unambiguous identity', async () => {
  for (const ambiguous of [false, true]) {
    const calls = [];
    const match = {id, first_name: contact.firstName, last_name: contact.lastName, organization_name: contact.company};
    const result = await sendLeadToApollo({contact: {...contact, email: ''}, settings, fetchImpl: mock([{created_contacts: ambiguous ? [match, {...match, id: 'a'.repeat(24)}] : [match]}, list], calls)});
    assert.equal(result.listAdded, !ambiguous);
    if (ambiguous) assert.match(result.message, /unambiguous/);
  }
});
