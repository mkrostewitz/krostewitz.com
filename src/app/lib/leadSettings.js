import 'server-only';
import {getDb} from './mongo';
import {leadRequirementSettings, assertApolloRequiredFields, normalizeRequiredLeadFields, assertRequiredLeadFields} from './leadRequirements.mjs';

export async function getLeadSettings() {
  const saved = await (await getDb()).collection('site_content').findOne({_id: 'lead_settings'});
  return leadRequirementSettings(saved);
}
export async function saveLeadSettings(input, user) {
  const requiredFields = normalizeRequiredLeadFields(input?.requiredFields);
  const current = await getLeadSettings();
  const apolloRequiredFields = normalizeRequiredLeadFields(input?.apolloRequiredFields ?? current.apolloRequiredFields);
  await (await getDb()).collection('site_content').updateOne({_id: 'lead_settings'}, {$set: {requiredFields, apolloRequiredFields, separateApolloRequirements: true, salutationRequirementConfigured: true, updatedAt: new Date(), updatedBy: user.email}}, {upsert: true});
  return {requiredFields, apolloRequiredFields};
}
export async function validateRequiredLeadFields(contact, leadTypes) {
  assertRequiredLeadFields(contact, leadTypes, (await getLeadSettings()).requiredFields);
}

export async function validateApolloRequiredFields(contact, leadTypes) {
  assertApolloRequiredFields(contact, leadTypes, await getLeadSettings());
}
