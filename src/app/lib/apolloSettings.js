import {ensureApolloSourceField} from "./apolloSource.mjs";
import {getApolloLists} from "./apolloLists.mjs";
import "server-only";
import {getDb} from "./mongo";
import {apolloSettingsStatus, apolloSettingsPatch, decryptApolloKey, validateApolloEnrollmentSettings} from "./apolloSettingsCore.mjs";
import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";

const ID = "apollo_settings";
async function collection() { return (await getDb()).collection("site_content"); }

export async function getApolloSettings() {
  return apolloSettingsStatus(await (await collection()).findOne({_id: ID}));
}

export async function saveApolloSettings(input, user) {
  let patch;
  try { patch = apolloSettingsPatch(input, process.env.AUTH_SECRET); }
  catch (error) { throw new ApolloEnrichmentError(error.message, 400); }
  if (patch.apiKeyEncrypted !== undefined) { patch.salutationFieldId = ""; patch.genderFieldId = ""; patch.sourceFieldId = ""; patch.tagsFieldId = ""; patch.productsFieldId = ""; patch.applicationsFieldId = ""; }
  const records = await collection();
  const existing = await records.findOne({_id: ID});
  const next = {...existing, ...patch};
  if (patch.listId) {
    let apiKey;
    try { apiKey = decryptApolloKey(next.apiKeyEncrypted, process.env.AUTH_SECRET); }
    catch { throw new ApolloEnrichmentError("Save a valid Apollo API key before choosing a list.", 400); }
    const {options} = await getApolloLists({apiKey});
    const selected = options.find((item) => item.id === patch.listId);
    if (!selected) throw new ApolloEnrichmentError("The selected contact list is no longer available. Refresh the lists and select one.", 400);
    patch.listName = selected.label;
  } else if (patch.listId === "") {
    patch.listName = "website_leads";
  }
  try { validateApolloEnrollmentSettings(next); }
  catch (error) { throw new ApolloEnrichmentError(error.message, 400); }
  if (patch.enabled && !apolloSettingsStatus({...existing, ...patch}).configured) {
    throw new ApolloEnrichmentError("Add an Apollo API key before enabling enrichment.", 400);
  }
  await records.updateOne({_id: ID}, {$set: {...patch, updatedAt: new Date(), updatedBy: user?.email || null}}, {upsert: true});
  return getApolloSettings();
}

export async function getApolloApiKey({requireEnabled = true} = {}) {
  const document = await (await collection()).findOne({_id: ID});
  if (!document?.apiKeyEncrypted || (requireEnabled && !apolloSettingsStatus(document).available)) {
    throw new ApolloEnrichmentError("Apollo enrichment is disabled or not configured in Integrations.", 503);
  }
  try {
    return decryptApolloKey(document.apiKeyEncrypted, process.env.AUTH_SECRET);
  } catch {
    throw new ApolloEnrichmentError("Unable to read the saved Apollo key. Replace it in Integrations.", 503);
  }
}


export const getApolloGenderFieldId = (apiKey) => getApolloCustomFieldId(apiKey, "genderFieldId", "Gender", 50);
export const getApolloSalutationFieldId = (apiKey) => getApolloCustomFieldId(apiKey, "salutationFieldId", "Salutation", 50);
export const getApolloSourceFieldId = (apiKey) => getApolloCustomFieldId(apiKey, "sourceFieldId", "Website Source", 200);
export const getApolloTagsFieldId = (apiKey) => getApolloCustomFieldId(apiKey, "tagsFieldId", "Contact Type", 6000);

export function getApolloCompanyFieldId(apiKey, key) {
  const labels = {products: "Company Products", applications: "Company Applications"};
  if (!Object.hasOwn(labels, key)) throw new Error("Invalid company field.");
  return getApolloCustomFieldId(apiKey, `${key}FieldId`, labels[key], 6000);
}

async function getApolloCustomFieldId(apiKey, key, label, maxLength) {
  const records = await collection();
  const existing = await records.findOne({_id: ID});
  if (existing?.[key]) return existing[key];
  const now = new Date();
  const locked = await records.findOneAndUpdate({_id: ID, $or: [{sourceFieldSetupUntil: {$exists: false}}, {sourceFieldSetupUntil: {$lt: now}}]},
    {$set: {sourceFieldSetupUntil: new Date(now.getTime() + 60000)}}, {returnDocument: "after"});
  if (!locked) throw Object.assign(new ApolloEnrichmentError("Apollo custom field is being configured. Sync will retry."), {retryable: true});
  try {
    const id = await ensureApolloSourceField({apiKey, label, maxLength});
    await records.updateOne({_id: ID, apiKeyEncrypted: locked.apiKeyEncrypted}, {$set: {[key]: id}});
    return id;
  } finally { await records.updateOne({_id: ID, sourceFieldSetupUntil: locked.sourceFieldSetupUntil}, {$unset: {sourceFieldSetupUntil: ""}}); }
}
