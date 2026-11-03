import {ObjectId} from 'mongodb';
import {companyKey, companyDetails, mergeCompanyDetails} from './leadCompanies.mjs';
import {apolloQueuePatch} from './apolloSyncQueue.mjs';
import {OutreachValidationError} from './leadOutreach.mjs';

export function serializeCompany(company) {
  return {id: String(company._id), name: company.name, ...companyDetails(company.details), revision: company.revision};
}

// Resolve without writing so lead validation runs before a shared company is changed.
export async function prepareLeadCompany(companies, contact, input = {}, current = {}) {
  const key = companyKey(contact.company);
  if (!key) return null;
  const id = Object.hasOwn(input, 'companyId') ? input.companyId
    : companyKey(current.contact?.company) === key ? current.companyId : null;
  let existing;
  if (id) {
    if (!/^[a-f0-9]{24}$/i.test(String(id))) throw new OutreachValidationError('Select a valid company.');
    existing = await companies.findOne({_id: new ObjectId(String(id))});
    if (!existing || existing.key !== key) throw new OutreachValidationError('The selected company changed. Reselect the company before saving.');
  } else {
    existing = await companies.findOne({key});
    // Legacy leads are migrated explicitly by selecting a saved company, never by name alone.
    if (existing) return null;
  }
  const details = mergeCompanyDetails(existing?.details, contact,
    input.companyDetailsBase || (current.companyId ? current.contact : null));
  Object.assign(contact, details, {company: existing?.name || contact.company.trim().replace(/\s+/g, ' ')});
  return {existing, key, name: contact.company};
}

export async function saveLeadCompany(companies, prepared, contact, now, user) {
  if (!prepared) return null;
  await companies.createIndex({key: 1}, {unique: true});
  const details = companyDetails(contact);
  const patch = {name: prepared.name, key: prepared.key, details, updatedAt: now, updatedBy: user?.email || null};
  if (!prepared.existing) {
    const document = {...patch, createdAt: now, revision: 1};
    try { document._id = (await companies.insertOne(document)).insertedId; }
    catch (error) {
      if (error.code === 11000) throw new OutreachValidationError('This company was just created. Reselect it before saving.');
      throw error;
    }
    return document;
  }
  const saved = await companies.findOneAndUpdate({_id: prepared.existing._id, revision: prepared.existing.revision},
    {$set: patch, $inc: {revision: 1}}, {returnDocument: 'after'});
  if (!saved) throw new OutreachValidationError('Company details changed while saving. Reselect the company and retry.');
  return saved;
}

// Lead copies are a compatibility cache; only explicitly linked leads receive updates.
export async function syncCompanyDetails(leads, company, now, user) {
  if (!company) return;
  const members = await leads.find({companyId: company._id}).toArray();
  if (!members.length) return;
  const shared = companyDetails(company.details);
  await leads.bulkWrite(members.map(lead => {
    const changed = JSON.stringify(companyDetails(lead.contact)) !== JSON.stringify(shared) || lead.contact?.company !== company.name;
    const patch = {companyKey: company.key, companyDetailsUpdatedAt: company.updatedAt,
      'contact.company': company.name,
      ...Object.fromEntries(Object.entries(shared).map(([field, value]) => [`contact.${field}`, value]))};
    if (changed) {
      Object.assign(patch, {updatedAt: now, updatedBy: user?.email || null});
      if (lead.apollo?.contactId) Object.assign(patch, apolloQueuePatch(now));
    }
    return {updateOne: {filter: {_id: lead._id, companyId: company._id}, update: {$set: patch}}};
  }));
}

export async function hydrateCompanyLeads(companies, leads) {
  const ids = [...new Map(leads.filter(lead => lead.companyId).map(lead => [String(lead.companyId), lead.companyId])).values()];
  if (!ids.length) return leads;
  const saved = await companies.find({_id: {$in: ids}}).toArray();
  const byId = new Map(saved.map(company => [String(company._id), company]));
  return leads.map(lead => {
    const company = byId.get(String(lead.companyId));
    return company ? {...lead, companyDetailsUpdatedAt: company.updatedAt,
      contact: {...lead.contact, ...companyDetails(company.details), company: company.name}} : lead;
  });
}
