import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_REQUIRED_LEAD_FIELDS, normalizeRequiredLeadFields, missingLeadFields, assertRequiredLeadFields, requiredFieldsFromSettings} from './leadRequirements.mjs';

const contact = {salutation: 'Dr.', firstName: 'Alex', email: 'alex@example.com', company: 'Example', address: {street: 'Main Street', city: 'Berlin', country: 'Germany'}, source: 'LinkedIn'};
test('defaults require sequence essentials and accept a complete lead', () => {
  assert.deepEqual(missingLeadFields(contact, ['Manufacturer']), []);
  assert.deepEqual(missingLeadFields({}, []), DEFAULT_REQUIRED_LEAD_FIELDS);
  assert.doesNotThrow(() => assertRequiredLeadFields(contact, ['Manufacturer']));
});
test('whitespace, empty categories, and legacy location cannot satisfy requirements', () => {
  assert.deepEqual(missingLeadFields({...contact, source: '  ', address: null, location: 'Berlin'}, [' ']), ['address.street', 'address.city', 'address.country', 'source', 'leadTypes']);
  assert.throws(() => assertRequiredLeadFields(contact, []), /Contact type/);
});
test('deselected fields are optional, including an explicitly empty configuration', () => {
  assert.deepEqual(normalizeRequiredLeadFields([]), []);
  assert.doesNotThrow(() => assertRequiredLeadFields({}, [], []));
  assert.deepEqual(missingLeadFields({company: 'Example'}, [], ['company']), []);
});
test('custom sequence fields can be required independently', () => {
  assert.deepEqual(missingLeadFields({...contact, products: ['Widget'], applications: []}, [], ['products', 'applications', 'address.postalCode']), ['applications', 'address.postalCode']);
  assert.throws(() => assertRequiredLeadFields(contact, [], ['products', 'applications']), /Products, Industry & applications/);
});
test('settings reject unknown fields and invalid payloads and deduplicate', () => {
  for (const input of [null, {}, 'company', ['unknown'], ['__proto__'], [1]]) assert.throws(() => normalizeRequiredLeadFields(input), /Choose valid/);
  assert.deepEqual(normalizeRequiredLeadFields(['company', 'company']), ['company']);
});

test('salutation is required by default, including existing configurations until explicitly changed', () => {
  assert.deepEqual(missingLeadFields({...contact, salutation: ''}, ['Manufacturer']), ['salutation']);
  assert.deepEqual(requiredFieldsFromSettings({requiredFields: ['email']}), ['salutation', 'email']);
  assert.deepEqual(requiredFieldsFromSettings({requiredFields: [], salutationRequirementConfigured: true}), []);
});

test('local and Apollo requirements are independent and legacy email moves to Apollo', async () => {
  const {leadRequirementSettings, assertApolloRequiredFields} = await import('./leadRequirements.mjs');
  const defaults = leadRequirementSettings(null);
  assert.equal(defaults.requiredFields.includes('email'), false);
  assert.deepEqual(defaults.apolloRequiredFields, ['email', 'company']);
  assert.doesNotThrow(() => assertRequiredLeadFields({...contact, email: ''}, ['Manufacturer'], defaults.requiredFields));
  assert.throws(() => assertApolloRequiredFields({...contact, email: ''}, ['Manufacturer'], defaults), /Apollo sync: Email/);
  const migrated = leadRequirementSettings({requiredFields: ['email', 'company'], salutationRequirementConfigured: true});
  assert.deepEqual(migrated.requiredFields, ['company']);
  assert.deepEqual(migrated.apolloRequiredFields, ['email', 'company']);
  const explicit = leadRequirementSettings({requiredFields: ['email'], apolloRequiredFields: [], separateApolloRequirements: true, salutationRequirementConfigured: true});
  assert.deepEqual(explicit.requiredFields, ['email']);
  assert.deepEqual(explicit.apolloRequiredFields, []);
  assert.throws(() => assertApolloRequiredFields({}, [], explicit), /Email/);
});

test('multiple contact types must be resolved explicitly even if the field is optional', async () => {
  const {assertApolloRequiredFields} = await import('./leadRequirements.mjs');
  assert.throws(() => assertRequiredLeadFields(contact, ['Manufacturer', 'Process automation'], []), /Choose one contact type/);
  assert.throws(() => assertApolloRequiredFields(contact, ['Manufacturer', 'Process automation'], {requiredFields: [], apolloRequiredFields: []}), /Choose one contact type/);
  assert.doesNotThrow(() => assertRequiredLeadFields(contact, ['Manufacturer', 'manufacturer'], []));
  assert.doesNotThrow(() => assertRequiredLeadFields(contact, [], []));
});
