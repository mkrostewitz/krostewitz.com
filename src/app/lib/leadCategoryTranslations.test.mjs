import test from 'node:test';
import assert from 'node:assert/strict';
import {localizeCompanyCategories, normalizeCategoryTranslation, storedLeadLanguage} from './leadCategoryTranslations.mjs';
import {normalizeContact} from './leadOutreach.mjs';
import {sendLeadToApollo} from './apolloOutreach.mjs';
import {translateCategoryLabels} from './leadCategoryAi.mjs';
const catalog = {
  products: [{label: 'Sensors', translations: {en: 'Sensors', de: 'Sensoren'}}],
  industries: [{label: 'Manufacturing', translations: {en: 'Manufacturing', de: 'Fertigung'}}],
};

test('contact language validates without resetting omitted legacy updates', () => {
  assert.equal(normalizeContact({firstName: 'Test', language: 'de'}).language, 'de');
  assert.equal(Object.hasOwn(normalizeContact({firstName: 'Test'}), 'language'), false);
  assert.throws(() => normalizeContact({firstName: 'Test', language: 'xx'}));
  assert.equal(storedLeadLanguage({language: 'de-DE'}), 'de');
  assert.equal(storedLeadLanguage({contact: {language: 'en'}, language: 'de'}), 'en');
  assert.equal(storedLeadLanguage({source: {context: {cvLanguage: 'de'}}}), 'de');
  assert.equal(storedLeadLanguage({}), 'en');
});

test('shared company selections stay canonical while contacts get separate languages', () => {
  const contact = {products: ['Sensors'], applications: ['Manufacturing'], industries: ['Manufacturing']};
  const before = structuredClone(contact);
  assert.deepEqual(localizeCompanyCategories({...contact, language: 'de'}, catalog).products, ['Sensoren']);
  assert.deepEqual(localizeCompanyCategories(contact, catalog, 'de').applications, ['Fertigung']);
  assert.deepEqual(localizeCompanyCategories(contact, catalog).products, ['Sensors']);
  assert.deepEqual(contact, before);
  assert.deepEqual(localizeCompanyCategories({products: [], applications: []}, catalog, 'de'), {products: [], applications: []});
  assert.deepEqual(localizeCompanyCategories({}, catalog, 'de'), {});
});

test('missing German translations block sync; legacy English labels remain usable', () => {
  assert.throws(() => localizeCompanyCategories({products: ['Unknown']}, catalog, 'de'), /Missing DE translations: Unknown/);
  assert.deepEqual(localizeCompanyCategories({products: ['Unknown']}, catalog).products, ['Unknown']);
  assert.throws(() => normalizeCategoryTranslation({kind: 'products', label: 'Sensors', translations: {en: 'Sensors', de: ''}}));
});

test('localized values reach Apollo custom fields on create and update', async () => {
  const id = '507f1f77bcf86cd799439011';
  const companyFieldIds = {products: '507f1f77bcf86cd799439012', applications: '507f1f77bcf86cd799439013'};
  for (const contactId of [undefined, id]) {
    const fields = [];
    const result = await sendLeadToApollo({
      contact: localizeCompanyCategories({firstName: 'Test', email: 'test@example.com', language: 'de', products: ['Sensors'], industries: ['Manufacturing']}, catalog),
      contactId, companyFieldIds, apiKey: 'test', settings: {available: true, listEnabled: true},
      fetchImpl: async (url, options) => {
        const body = JSON.parse(options.body);
        if (url.endsWith('contacts/bulk_create')) {fields.push(body.contacts[0]); return {ok: true, json: async () => ({created_contacts: [{id, email: 'test@example.com'}]})};}
        if (options.method === 'PATCH') {fields.push(body); return {ok: true, json: async () => ({contact: {id, typed_custom_fields: body.typed_custom_fields}})};}
        return {ok: true, json: async () => ({labels: [{name: 'website_leads'}]})};
      }
    });
    assert.equal(result.detailsUpdated, true);
    for (const field of fields) assert.deepEqual(field.typed_custom_fields, {[companyFieldIds.products]: 'Sensoren', [companyFieldIds.applications]: 'Fertigung'});
  }
});

test('AI output must contain complete validated translations for every input', async () => {
  const fetchImpl = async () => ({ok: true, json: async () => ({output_text: JSON.stringify({translations: [{en: 'Sensors', de: 'Sensoren'}]})})});
  assert.deepEqual(await translateCategoryLabels({labels: ['Sensors'], apiKey: 'test', model: 'test', fetchImpl}), [{en: 'Sensors', de: 'Sensoren'}]);
  await assert.rejects(translateCategoryLabels({labels: ['Sensors', 'Manufacturing'], apiKey: 'test', fetchImpl}), /Incomplete/);
});

test('industry edits retain their collection kind instead of becoming applications', async () => {
  const {getCategoryTranslations} = await import('./leadCategoryTranslations.mjs');
  const db = {collection(name) {return {find() {return {sort() {return {async toArray() {
    return name === 'lead_industries' ? [{label: 'Manufacturing', translations: {en: 'Manufacturing', de: 'Fertigung'}}] : [];
  }};}};}};}};
  const catalog = await getCategoryTranslations(db);
  const input = normalizeCategoryTranslation(catalog.industries[0]);
  assert.equal(input.kind, 'industries');
  assert.equal(input.translations.de, 'Fertigung');
});
