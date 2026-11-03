import test from 'node:test';
import assert from 'node:assert/strict';
import {ObjectId} from 'mongodb';
import {prepareLeadCompany, saveLeadCompany, syncCompanyDetails, hydrateCompanyLeads, serializeCompany} from './leadCompanySync.mjs';
import {companyDetails} from './leadCompanies.mjs';

const sameId = (a, b) => String(a) === String(b);
function companiesStore() {
  const rows = [];
  return {rows, async createIndex() {},
    async findOne(query) {return rows.find(row => query._id ? sameId(row._id, query._id) : row.key === query.key) || null;},
    async insertOne(row) {const _id = new ObjectId(); rows.push({...row, _id}); return {insertedId: _id};},
    async findOneAndUpdate(query, update) {
      const index = rows.findIndex(row => sameId(row._id, query._id) && row.revision === query.revision);
      if (index < 0) return null;
      rows[index] = {...rows[index], ...update.$set, revision: rows[index].revision + 1};
      return rows[index];
    },
    find(query) {return {toArray: async () => rows.filter(row => query._id.$in.some(id => sameId(id, row._id)))};},
  };
}
function leadsStore(rows) {
  return {writes: [], find(query) {return {toArray: async () => rows.filter(row => sameId(row.companyId, query.companyId))};},
    async bulkWrite(ops) {this.writes.push(...ops);}};
}
const now = new Date('2026-11-03');
const user = {email: 'admin@example.com'};

test('gradual migration creates a company from the first lead and links the second only on selection', async () => {
  const companies = companiesStore();
  const first = {company: 'Acme', website: 'https://example.com', products: ['Sensors'], email: 'first@example.com'};
  const prepared = await prepareLeadCompany(companies, first);
  const saved = await saveLeadCompany(companies, prepared, first, now, user);
  assert.ok(saved._id instanceof ObjectId);
  assert.equal(companies.rows.length, 1);
  assert.equal(Object.hasOwn(saved.details, 'email'), false);
  const legacy = {company: ' ACME ', website: 'https://legacy.example.com', email: 'second@example.com'};
  assert.equal(await prepareLeadCompany(companies, legacy), null);
  assert.equal(legacy.website, 'https://legacy.example.com');
  const selected = await prepareLeadCompany(companies, legacy, {companyId: String(saved._id)});
  assert.equal(legacy.website, 'https://example.com');
  assert.equal(legacy.email, 'second@example.com');
  const updated = await saveLeadCompany(companies, selected, legacy, now, user);
  assert.equal(String(updated._id), String(saved._id));
  assert.equal(companies.rows.length, 1);
  assert.equal(serializeCompany(updated).id, String(saved._id));
});

test('updates and clears reach linked leads only, queue Apollo and preserve personal fields', async () => {
  const company = {_id: new ObjectId(), key: 'acme', name: 'Acme', details: companyDetails({website: ''}), updatedAt: now};
  const rows = [
    {_id: 'linked', companyId: company._id, contact: {company: 'Acme', website: 'https://old.example.com'}, apollo: {contactId: 'remote'}},
    {_id: 'legacy', contact: {company: 'Acme', website: 'https://legacy.example.com'}, apollo: {contactId: 'other'}},
  ];
  const leads = leadsStore(rows);
  await syncCompanyDetails(leads, company, now, user);
  assert.equal(leads.writes.length, 1);
  const update = leads.writes[0].updateOne;
  assert.equal(update.filter._id, 'linked');
  assert.equal(update.update.$set['contact.website'], '');
  assert.equal(update.update.$set['apollo.status'], 'pending');
  assert.equal(Object.hasOwn(update.update.$set, 'contact.email'), false);
  assert.ok(update.filter.companyId instanceof ObjectId);
});

test('reads inherit from company records, never by matching an unlinked name', async () => {
  const companies = companiesStore();
  const contact = {company: 'Acme', website: 'https://current.example.com'};
  const company = await saveLeadCompany(companies, await prepareLeadCompany(companies, contact), contact, now, user);
  const leads = await hydrateCompanyLeads(companies, [
    {companyId: company._id, contact: {company: 'Acme', website: 'https://stale.example.com', email: 'a@example.com'}},
    {contact: {company: 'Acme', website: 'https://legacy.example.com'}},
  ]);
  assert.equal(leads[0].contact.website, company.details.website);
  assert.equal(leads[0].contact.email, 'a@example.com');
  assert.equal(leads[1].contact.website, 'https://legacy.example.com');
});

test('invalid selection and concurrent writes cannot overwrite the company silently', async () => {
  const companies = companiesStore();
  const contact = {company: 'Acme', website: 'https://example.com'};
  const company = await saveLeadCompany(companies, await prepareLeadCompany(companies, contact), contact, now, user);
  await assert.rejects(prepareLeadCompany(companies, {...contact}, {companyId: 'invalid'}), /valid company/);
  await assert.rejects(prepareLeadCompany(companies, {company: 'Other'}, {companyId: String(new ObjectId())}), /Reselect/);
  const selected = {companyId: String(company._id), companyDetailsBase: company.details};
  const one = await prepareLeadCompany(companies, {...contact}, selected);
  const two = await prepareLeadCompany(companies, {...contact}, selected);
  await saveLeadCompany(companies, one, {...contact, website: ''}, now, user);
  await assert.rejects(saveLeadCompany(companies, two, contact, now, user), /changed while saving/);
});

test('renaming preserves the company ID and propagates the name to linked leads', async () => {
  const companies = companiesStore();
  const original = {company: 'Acme', website: 'https://example.com'};
  const company = await saveLeadCompany(companies, await prepareLeadCompany(companies, original), original, now, user);
  const contact = {...original, company: 'Acme International'};
  const prepared = await prepareLeadCompany(companies, contact, {companyNameBase: 'Acme'}, {companyId: company._id, contact: original});
  const renamed = await saveLeadCompany(companies, prepared, contact, now, user);
  assert.equal(String(renamed._id), String(company._id));
  assert.equal(companies.rows.length, 1);
  assert.equal(renamed.key, 'acme international');
  const leads = leadsStore([{_id: 'linked', companyId: company._id, contact: original, apollo: {contactId: 'remote'}}]);
  await syncCompanyDetails(leads, renamed, now, user);
  assert.equal(leads.writes[0].updateOne.update.$set['contact.company'], 'Acme International');
  assert.equal(leads.writes[0].updateOne.update.$set['apollo.status'], 'pending');
  const stale = {...original};
  await prepareLeadCompany(companies, stale, {companyId: String(company._id), companyNameBase: 'Acme'});
  assert.equal(stale.company, 'Acme International');
});

test('explicit unlink allows a new company, and selecting an existing company inherits it', async () => {
  const companies = companiesStore();
  const original = {company: 'Acme', website: 'https://example.com'};
  const company = await saveLeadCompany(companies, await prepareLeadCompany(companies, original), original, now, user);
  const current = {companyId: company._id, contact: original};
  assert.equal(await prepareLeadCompany(companies, {company: ''}, {companyId: null}, current), null);
  await assert.rejects(prepareLeadCompany(companies, {company: ''}, {}, current), /unlink/);
  const contact = {company: 'New Company'};
  const saved = await saveLeadCompany(companies, await prepareLeadCompany(companies, contact, {companyId: null}, current), contact, now, user);
  assert.notEqual(String(saved._id), String(company._id));
  const selected = {company: 'Acme'};
  const prepared = await prepareLeadCompany(companies, selected, {companyId: String(company._id)}, {companyId: saved._id, contact});
  assert.equal(String(prepared.existing._id), String(company._id));
  assert.equal(selected.website, original.website);
});

test('rename collisions are rejected before writing and at the unique-index boundary', async () => {
  const companies = companiesStore();
  for (const name of ['Acme', 'Other']) {
    const contact = {company: name};
    await saveLeadCompany(companies, await prepareLeadCompany(companies, contact), contact, now, user);
  }
  const company = companies.rows[0];
  await assert.rejects(prepareLeadCompany(companies, {company: ' OTHER '}, {companyId: String(company._id)}), /already exists/);
  const contact = {company: 'New Name'};
  const prepared = await prepareLeadCompany(companies, contact, {companyId: String(company._id)});
  companies.findOneAndUpdate = async () => {throw Object.assign(new Error('duplicate'), {code: 11000});};
  await assert.rejects(saveLeadCompany(companies, prepared, contact, now, user), /already exists/);
});
