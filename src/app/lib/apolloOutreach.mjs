import {apolloSenderStatus} from "./apolloSender.mjs";
import {normalizeCategories} from "./contactCategories.mjs";
import {normalizeLeadTypes} from "./leadTypes.mjs";
import {getApolloLists} from "./apolloLists.mjs";
import {apolloLeadLabels, resolveApolloSequence} from "./apolloRouting.mjs";
import {ApolloEnrichmentError} from "./apolloEnrichment.mjs";
import {normalizeContact} from "./leadOutreach.mjs";

export const APOLLO_LEAD_LIST = "website_leads";

export async function sendLeadToApollo({contact, settings, apiKey, sendingAccount = null, enroll = false, sequenceId = "", categories = [], contactId = null, sourceFieldId = null, salutationFieldId = null, genderFieldId = null, tagsFieldId = null, companyFieldIds = {}, onContactLinked = async () => {}, fetchImpl = fetch}) {
  if (!settings?.available || !settings.listEnabled) throw new ApolloEnrichmentError("Enable the Apollo list action in Integrations first.", 403);
  if (contactId && !/^[a-f0-9]{24}$/i.test(contactId)) throw new ApolloEnrichmentError("Invalid Apollo contact ID.", 400);
  let listName = settings.listName || APOLLO_LEAD_LIST;
  if (settings.listId) {
    const {options} = await getApolloLists({apiKey, fetchImpl});
    const selected = options.find((item) => item.id === settings.listId);
    if (!selected) throw new ApolloEnrichmentError("The selected Apollo list is no longer available. Choose a list in Integrations.", 400);
    listName = selected.label;
  }
  let labels, target;
  try { labels = [...new Set([listName, ...(tagsFieldId ? [] : apolloLeadLabels(categories))])]; target = resolveApolloSequence(settings, categories, sequenceId, contact?.source); }
  catch (error) { throw new ApolloEnrichmentError(error.message, 400); }
  if (enroll && (!settings.sequenceEnabled || !target || !settings.emailAccountId)) throw new ApolloEnrichmentError("Sequence enrollment is not configured in Integrations.", 403);
  if (enroll && sendingAccount && sendingAccount.id !== settings.emailAccountId) throw new ApolloEnrichmentError("Sending account changed. Reload Integrations before enrolling.", 400);
  let normalized;
  try { normalized = normalizeContact(contact); }
  catch (error) { throw new ApolloEnrichmentError(error.message, 400); }
  if (enroll && !normalized.email) throw new ApolloEnrichmentError("Add an email before enrolling this contact in an email sequence.", 400);
  const fields = {first_name: normalized.firstName, last_name: normalized.lastName, email: normalized.email,
    organization_name: normalized.company, title: normalized.role, website_url: normalized.website,
    present_raw_address: normalized.location, direct_phone: normalized.phone, linkedin_url: normalized.linkedinUrl};
  if (Object.hasOwn(normalized, "source")) {
    if (!/^[a-f0-9]{24}$/i.test(sourceFieldId || "")) throw new ApolloEnrichmentError("Apollo Source field is not configured.", 400);
    fields.typed_custom_fields = {[sourceFieldId]: normalized.source};
  }
  if (Object.hasOwn(normalized, "salutation")) {
    if (!/^[a-f0-9]{24}$/i.test(salutationFieldId || "")) throw new ApolloEnrichmentError("Apollo Salutation field is not configured.", 400);
    fields.typed_custom_fields = {...fields.typed_custom_fields, [salutationFieldId]: normalized.salutation};
  }
  if (Object.hasOwn(normalized, "gender")) {
    if (!/^[a-f0-9]{24}$/i.test(genderFieldId || "")) throw new ApolloEnrichmentError("Apollo Gender field is not configured.", 400);
    fields.typed_custom_fields = {...fields.typed_custom_fields, [genderFieldId]: normalized.gender};
  }
  if (tagsFieldId) {
    if (!/^[a-f0-9]{24}$/i.test(tagsFieldId)) throw new ApolloEnrichmentError("Apollo Contact Type field is not configured.", 400);
    fields.typed_custom_fields = {...fields.typed_custom_fields, [tagsFieldId]: normalizeLeadTypes(categories).join("; ")};
  }
  for (const key of ["products", "applications"]) {
    if (!Object.hasOwn(normalized, key)) continue;
    const id = companyFieldIds[key];
    if (!/^[a-f0-9]{24}$/i.test(id || "")) throw new ApolloEnrichmentError(`Apollo company ${key} field is not configured.`, 400);
    fields.typed_custom_fields = {...fields.typed_custom_fields, [id]: normalizeCategories(normalized[key]).join(", ")};
  }
  // An email-less local record must not erase a known remote email on sync.
  if (!normalized.email) delete fields.email;
  const result = {contactId, detailsUpdated: false, labelsAdded: false, listAdded: false, sequenceStatus: "not_requested", message: ""};
  async function post(path, body, method = "POST") {
    let response;
    try {
      response = await fetchImpl(`https://api.apollo.io/api/v1/${path}`, {
        method, cache: "no-store", signal: AbortSignal.timeout(path.startsWith("labels/") ? 30000 : 15000),
        headers: {"Content-Type": "application/json", accept: "application/json", "X-Api-Key": apiKey},
        body: JSON.stringify(body),
      });
    } catch (cause) {
      const action = method === "PATCH" ? "contact update" : path.startsWith("labels/") ? "list/tag assignment" : path === "contacts/bulk_create" ? "contact creation" : "sequence enrollment";
      const timeout = ["TimeoutError", "AbortError"].includes(cause.name);
      throw Object.assign(new Error(`Apollo ${action} ${timeout ? "timed out" : "could not connect"}.`),
        {retryable: true, errorCode: timeout ? "timeout" : "network"});
    }
    if (!response.ok) throw Object.assign(new Error(response.status === 401 || response.status === 403
      ? `Apollo denied ${method === "PATCH" ? "contact update" : path === "contacts/bulk_create" ? "contact creation" : path.startsWith("labels/") ? "list assignment" : "sequence enrollment"} (HTTP ${response.status}). Check api/v1/${method === "PATCH" ? "contacts/update" : path.startsWith("emailer_campaigns/") ? "emailer_campaigns/add_contact_ids" : path} in your key permissions and workspace access.`
      : response.status === 429 ? "Apollo's request limit was reached. Try again later."
      : `Apollo rejected ${path} (HTTP ${response.status}). Check the contact and destination settings in Apollo.`), {retryable: response.status === 429 || response.status >= 500, errorCode: `http_${response.status}`});
    try { return await response.json(); }
    catch { throw new Error("Apollo returned an unreadable response. Check the contact in Apollo before retrying."); }
  }
  try {
    let matched = contactId ? {id: contactId} : null;
    let needsUpdate = Boolean(contactId);
    if (!matched) {
      const data = await post("contacts/bulk_create", {run_dedupe: true, contacts: [fields]});
      const created = Array.isArray(data.created_contacts) ? data.created_contacts : [];
      const existing = Array.isArray(data.existing_contacts) ? data.existing_contacts : [];
      const key = value => String(value || "").normalize("NFKC").trim().toLowerCase();
      const candidates = [...created, ...existing].filter(item => {
        if (!/^[a-f0-9]{24}$/i.test(item.id)) return false;
        if (normalized.email) return item.email?.toLowerCase() === normalized.email;
        if (normalized.linkedinUrl && key(item.linkedin_url) === key(normalized.linkedinUrl)) return true;
        return key(item.first_name) === key(normalized.firstName) && key(item.last_name) === key(normalized.lastName)
          && Boolean(normalized.company) && key(item.organization_name || item.organization?.name || item.account?.name) === key(normalized.company);
      });
      matched = candidates.length === 1 ? candidates[0] : null;
      if (!matched) throw new Error(normalized.email ? "Apollo did not return a contact with the same email. Check the contact in Apollo." : "Apollo did not return one unambiguous matching contact. Check Apollo before retrying or add an email.");
      needsUpdate = existing.some((item) => item.id === matched.id);
    }
    result.contactId = matched.id;
    // Persist identity before subsequent API calls can fail.
    await onContactLinked(matched.id);
    if (needsUpdate || fields.typed_custom_fields) {
      const updated = await post(`contacts/${matched.id}`, fields, "PATCH");
      if (updated.contact?.custom_field_errors && Object.keys(updated.contact.custom_field_errors).length) throw new Error("Apollo rejected a custom contact field. Check its type and permissions.");
      if (sourceFieldId && String(updated.contact?.typed_custom_fields?.[sourceFieldId] ?? "") !== normalized.source) throw new Error("Apollo did not confirm the Source value. Sequence enrollment was not started.");
      if (tagsFieldId && String(updated.contact?.typed_custom_fields?.[tagsFieldId] ?? "") !== fields.typed_custom_fields[tagsFieldId]) throw new Error("Apollo did not confirm Contact Type. Sequence enrollment was not started.");
      for (const [id, value] of Object.entries(fields.typed_custom_fields || {})) {
        if (String(updated.contact?.typed_custom_fields?.[id] ?? "") !== value) throw new Error("Apollo did not confirm a custom field value. Sequence enrollment was not started.");
      }
      if (updated.contact?.id !== matched.id) throw new Error("Apollo did not confirm the contact update.");
    }
    result.detailsUpdated = true;
    const lists = await post("labels/add_entity_ids_to_label_names", {entity_ids: [matched.id], label_names: labels, modality: "contacts", async: false});
    if (!lists.labels?.some((label) => label.name?.toLowerCase() === listName.toLowerCase())) throw new Error(`Apollo did not confirm list membership. Check ${listName} in Apollo.`);
    result.listAdded = true;
    result.message = `Contact synced with Apollo. List membership confirmed: ${listName}.`;
    if (!labels.every((name) => lists.labels.some((label) => label.name.toLowerCase() === name.toLowerCase()))) {
      result.message += " Some category labels were not confirmed by Apollo. Check the contact before enrolling.";
      return result;
    }
    result.labelsAdded = true;
    if (labels.length > 1) result.message += ` Categories: ${labels.slice(1).join(", ")}.`;
    if (!enroll) return result;
    result.sequenceId = target.sequenceId;
    result.sequenceStatus = "unknown";
    const sequence = await post(`emailer_campaigns/${encodeURIComponent(target.sequenceId)}/add_contact_ids`, {
      emailer_campaign_id: target.sequenceId, contact_ids: [matched.id],
      send_email_from_email_account_id: settings.emailAccountId,
      ...(sendingAccount?.email ? {send_email_from_email_address: sendingAccount.email} : {}), status: "active",
      sequence_no_email: false, sequence_unverified_email: false, sequence_job_change: false,
      sequence_active_in_other_campaigns: false, sequence_finished_in_other_campaigns: false,
      sequence_same_company_in_same_campaign: false, contacts_without_ownership_permission: false,
      add_if_in_queue: false, contact_verification_skipped: false,
    });
    result.senderAccountId = settings.emailAccountId;
    result.senderEmail = sendingAccount?.email || "";
    const membership = sequence.contacts?.find(item => item.id === matched.id)?.contact_campaign_statuses?.find(item => item.emailer_campaign_id === target.sequenceId);
    result.senderStatus = apolloSenderStatus(membership, {id: settings.emailAccountId, email: sendingAccount?.email});
    const skipped = sequence.skipped_contact_ids?.[matched.id];
    if (skipped) {
      result.sequenceStatus = skipped === "contacts_already_exists_in_current_campaign" ? "already_enrolled" : "skipped";
      result.message += result.sequenceStatus === "already_enrolled" ? " Already in the selected sequence; it was not restarted." : ` Sequence enrollment skipped by Apollo (${String(skipped).slice(0, 150)}).`;
    } else if (sequence.contacts?.some((item) => item.id === matched.id)) {
      result.sequenceStatus = "enrolled";
      result.message += " Added to the selected sequence. Delivery follows its status and schedule in Apollo.";
    } else {
      result.message += " Apollo did not confirm sequence enrollment. Check the sequence before retrying.";
    }
    if (result.senderStatus === "mismatch") result.message += " Apollo reports a different sending account. Change the sender for this contact in Apollo before sending; syncing does not change an existing enrollment’s sender.";
    else if (result.senderStatus === "unknown") result.message += " Sender assignment was not confirmed. Refresh Apollo status to verify the sending account.";
  } catch (error) {
    result.retryable = error.retryable === true;
    result.errorCode = error.errorCode || "unconfirmed";
    result.message = `${result.listAdded ? `List membership confirmed: ${listName}. ` : result.contactId ? "Apollo contact linked; sync was not completed. " : ""}${error.message}`;
  }
  return result;
}
