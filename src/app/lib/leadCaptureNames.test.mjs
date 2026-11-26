import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {contactNames} from "./leadOutreach.mjs";

const source = await readFile(new URL("./leads.js", import.meta.url), "utf8");
const inputFunction = source.slice(source.indexOf("function normalizeLeadInput("), source.indexOf("function hashDownloadToken("));
const cleanFunction = source.slice(source.indexOf("function cleanText("), source.indexOf("function normalizeEmail("));
const errorClass = source.slice(source.indexOf("export class LeadValidationError"), source.indexOf("function getLeadsCollection(")).replace("export ", "");
const normalize = new Function("normalizeSourceType", "normalizeEmail", "normalizeRequestType", "normalizePhone", "getPreferredLeadLanguage", "normalizeCvLanguage", `${errorClass}\n${cleanFunction}\n${inputFunction}\nreturn normalizeLeadInput;`)(
  value => value || "contact_form", value => value.trim().toLowerCase(), value => value || "general", value => value || "", () => "en", value => value
);

for (const sourceType of ["contact_form", "cv_download", "attachment_download"]) {
  const input = {sourceType, firstName: "  Mary Jane  ", lastName: "  van der Berg  ", name: "Incorrect guessed name", email: "mary@example.com", message: "Please contact me.", requestType: "employer", phone: "+4915712345678", timelineEntryId: "role", documentId: "study"};
  test(`${sourceType} stores explicit compound names for lead autofill`, () => {
    const {contact} = normalize(input);
    assert.equal(contact.firstName, "Mary Jane");
    assert.equal(contact.lastName, "van der Berg");
    assert.equal(contact.name, "Mary Jane van der Berg");
    assert.deepEqual(contactNames(contact), {firstName: contact.firstName, lastName: contact.lastName, name: contact.name});
  });
  test(`${sourceType} requires both name fields on the server`, () => {
    for (const field of ["firstName", "lastName"]) {
      assert.throws(() => normalize({...input, [field]: "  "}), error => error.status === 400 && error.errorCode === `contact.form.validation.${field}`);
    }
  });
}

test("preserves international names, apostrophes and hyphens", () => {
  const {contact} = normalize({firstName: "Zoë-Anne", lastName: "O’Neill", email: "zoe@example.com", message: "Please contact me."});
  assert.equal(contact.name, "Zoë-Anne O’Neill");
});
