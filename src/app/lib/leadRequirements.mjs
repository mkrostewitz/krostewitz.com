import {normalizeSingleLeadType} from "./leadTypes.mjs";
import {OutreachValidationError} from './leadOutreach.mjs';

export const LEAD_REQUIREMENT_FIELDS = {
  salutation: 'Salutation', gender: 'Gender', firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone',
  company: 'Company name', role: 'Job title', linkedinUrl: 'LinkedIn profile',
  source: 'Lead source', leadTypes: 'Contact type', website: 'Company website',
  'address.street': 'Street', 'address.houseNumber': 'House / building number',
  'address.postalCode': 'Postal code', 'address.city': 'City',
  'address.region': 'State / region', 'address.country': 'Country',
  industries: 'Industries', products: 'Products', applications: 'Industry & applications',
};
export const DEFAULT_REQUIRED_LEAD_FIELDS = ['salutation', 'firstName', 'company', 'address.street', 'address.city', 'address.country', 'source', 'leadTypes'];

export const DEFAULT_APOLLO_REQUIRED_FIELDS = ['email', 'company'];

export function normalizeRequiredLeadFields(fields) {
  if (!Array.isArray(fields) || fields.some(key => typeof key !== 'string' || !Object.hasOwn(LEAD_REQUIREMENT_FIELDS, key))) {
    throw new OutreachValidationError('Choose valid required lead fields.');
  }
  return [...new Set(fields)];
}
export function missingLeadFields(contact = {}, leadTypes = [], requiredFields = DEFAULT_REQUIRED_LEAD_FIELDS) {
  const filled = value => Array.isArray(value) ? value.some(filled) : typeof value === 'string' && Boolean(value.trim());
  return requiredFields.filter(key => {
    const value = key === 'leadTypes' ? leadTypes : key.split('.').reduce((current, part) => current?.[part], contact);
    return !filled(value);
  });
}
export function assertRequiredLeadFields(contact, leadTypes, requiredFields) {
  normalizeSingleLeadType(leadTypes);
  const missing = missingLeadFields(contact, leadTypes, requiredFields);
  if (missing.length) throw new OutreachValidationError(`Complete required lead fields: ${missing.map(key => LEAD_REQUIREMENT_FIELDS[key]).join(', ')}.`);
}

// Apply the new default once to configurations saved before Salutation existed.
export function requiredFieldsFromSettings(saved) {
  const fields = normalizeRequiredLeadFields(saved?.requiredFields ?? DEFAULT_REQUIRED_LEAD_FIELDS);
  return saved && !saved.salutationRequirementConfigured ? [...new Set(['salutation', ...fields])] : fields;
}

export function leadRequirementSettings(saved) {
  const legacy = requiredFieldsFromSettings(saved);
  const separated = saved?.separateApolloRequirements === true;
  return {
    requiredFields: separated ? legacy : legacy.filter(key => key !== 'email'),
    apolloRequiredFields: normalizeRequiredLeadFields(saved?.apolloRequiredFields ??
      (saved && !separated ? [...new Set([...legacy, ...DEFAULT_APOLLO_REQUIRED_FIELDS])] : DEFAULT_APOLLO_REQUIRED_FIELDS)),
  };
}
export function assertApolloRequiredFields(contact, leadTypes, settings) {
  normalizeSingleLeadType(leadTypes);
  const missing = missingLeadFields(contact, leadTypes, [...new Set([...settings.requiredFields, ...settings.apolloRequiredFields])]);
  if (missing.length) throw new OutreachValidationError(`Complete required fields for Apollo sync: ${missing.map(key => LEAD_REQUIREMENT_FIELDS[key]).join(', ')}.`);
}
