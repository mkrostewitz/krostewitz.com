"use client";

import { Autocomplete, TextField, Paper, Typography, Alert, Link, MenuItem, Box } from "@mui/material";
import { LeadField, LeadButton, LeadIconButton, LeadAccordion, LeadScope } from "./LeadUi";
import { LEAD_STATUS_OPTIONS, CLOSED_STATUSES } from "../../lib/leadStatuses.mjs";
import { useEffect, useId, useMemo, useState } from "react";
import { Unlink } from "lucide-react";
import { createPortal } from "react-dom";
import { ACTIVITY_TYPES, CHANNELS, CONTACT_FIELDS, addDays, localDay, suggestedFollowUp, suggestedActivityStatus } from "../../lib/leadOutreach.mjs";
import { useSnackbar } from "./LeadSnackbar";
import styles from "../admin.module.css";
import DisclosureSummary from "./DisclosureSummary";
import outreach from "./outreach.module.css";
import ActivityModal from "./ActivityModal";
import ContactResearch from "./ContactResearch";
import LeadPhotoEditor from "./LeadPhotoEditor";
import ApolloEnrichment from "./ApolloEnrichment";
import ApolloOutreach from "./ApolloOutreach";
import LeadSource from "./LeadSource";
import LinkedInProfileButton from "./LinkedInProfileButton";
import CompanyFields from "./CompanyFields";
import { researchCategories, companyCategories } from "../../lib/contactResearch.mjs";
import LeadMap from "./LeadMap";
import useContactGeocoding from "./useContactGeocoding";
import LeadContactType from "./LeadContactType";
import { getLeadTypes } from "../../lib/leadTypes.mjs";
import { linkedinProfileState, normalizeLinkedinProfileUrl } from "../../lib/linkedinProfile.mjs";
import {useLeadRequirements} from "./LeadRequirements";
import {missingLeadFields, assertRequiredLeadFields, LEAD_REQUIREMENT_FIELDS} from "../../lib/leadRequirements.mjs";
import AddressFields from "./AddressFields";
import {companyKey, companyDetails} from "../../lib/leadCompanies.mjs";
import { formatAddress, normalizeAddress } from "../../lib/leadAddress.mjs";
const LABELS = {
  firstName: "First name",
  lastName: "Last name",
  company: "Company",
  role: "Role / job title",
  location: "Contact address / city",
  email: "Email",
  phone: "Phone",
  linkedinUrl: "LinkedIn profile URL",
  website: "Company website",
  detailsSource: "Source link (optional)"
};
export default function OutreachForm({
  lead,
  saving,
  onSave,
  onCancel,
  onDelete,
  footerTarget,
  children,
  companyNames = [],
  companies = [],
  leadTypes = []
}) {
  const {
    showSnackbar
  } = useSnackbar();
  const {requiredFields} = useLeadRequirements();
  const formId = useId();
  const [apolloSettings, setApolloSettings] = useState(null);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/leads/enrich", {
      cache: "no-store",
      signal: abort.signal
    }).then(async response => {
      if (!response.ok) throw new Error("Unable to load enrichment settings.");
      setApolloSettings(await response.json());
    }).catch(error => {
      if (error.name !== "AbortError") setApolloSettings({
        available: false,
        error: "Unable to load enrichment settings. Reopen the form to try again."
      });
    });
    return () => abort.abort();
  }, []);
  const [tags, setTags] = useState(() => getLeadTypes(lead));
  const [research, setResearch] = useState(lead?.research || null);
  const [contact, setContact] = useState(() => ({
    ...Object.fromEntries(CONTACT_FIELDS.map(key => [key, lead?.[key] || ""])),
    source: lead?.contactSource || "",
    ...companyCategories({
      applications: lead?.applications,
      industries: lead?.industries ?? researchCategories(lead?.research).industries,
      products: lead?.products ?? researchCategories(lead?.research).products
    }),
    ...(lead?.address ? {
      address: normalizeAddress(lead.address)
    } : {})
  }));
  const [companyBase, setCompanyBase] = useState(() => companyDetails(lead || {}));
  const [companyId, setCompanyId] = useState(lead?.companyId || null);
  const [companyNameBase, setCompanyNameBase] = useState(lead?.company || "");
  function selectCompany(value, reason) {
    if (reason === "createOption" && companyId) {
      setContact(current => ({...current, company: value || ""}));
      return;
    }
    const company = value || "";
    const saved = companies.find(item => companyKey(item.name) === companyKey(company));
    setCompanyId(saved?.id || null);
    if (saved) {
      const details = companyDetails(saved);
      setCompanyBase(details);
      setCompanyNameBase(saved.name);
      setContact(current => ({...current, company: saved.name, ...details}));
    } else {
      setCompanyBase(companyDetails(contact));
      setContact(current => ({...current, company}));
    }
  }
  function unlinkCompany() {
    const empty = companyDetails();
    setCompanyId(null);
    setCompanyBase(empty);
    setCompanyNameBase("");
    setContact(current => ({...current, company: "", ...empty}));
  }
  const linkedin = linkedinProfileState(contact.linkedinUrl);
  const linkedinHelpId = useId();
  const {
    message: geocodeMessage,
    prepareContact,
    retry,
    needsGeocoding
  } = useContactGeocoding(contact, setContact);
  const [preparing, setPreparing] = useState(false);
  const mapLeads = useMemo(() => [{
    ...lead,
    ...contact,
    id: lead?.id || "draft",
    name: [contact.firstName, contact.lastName].filter(Boolean).join(" ")
  }], [lead, contact]);
  const [status, setStatus] = useState(lead?.status || "pending");
  const [preferredChannel, setPreferredChannel] = useState(lead?.preferredChannel || "linkedin");
  const [activityOpen, setActivityOpen] = useState(false);
  const [draftActivity, setDraftActivity] = useState(null);
  const [manualDefaults, setManualDefaults] = useState({});
  function markManual(key) {
    setManualDefaults(current => ({
      ...current,
      [key]: true
    }));
  }
  function removeDraftActivity() {
    setDraftActivity(null);
    if (!manualDefaults.status) setStatus("pending");
    if (!manualDefaults.preferredChannel) setPreferredChannel("linkedin");
    if (!manualDefaults.followUpOn) setFollowUpOn("");
  }
  const [followUpOn, setFollowUpOn] = useState(lead?.followUpOn || "");
  const [followUpTask, setFollowUpTask] = useState(lead?.followUpTask || "");
  const suggestion = suggestedFollowUp({
    ...lead,
    status
  }, draftActivity);
  const closed = CLOSED_STATUSES.includes(status);
  const query = encodeURIComponent([contact.firstName, contact.lastName, contact.company].filter(Boolean).join(" "));
  async function savePatch(patch) {
    setPreparing(true);
    try {
      assertRequiredLeadFields(contact, tags, requiredFields);
      return await onSave({
        ...patch,
        companyId,
        companyNameBase,
        companyDetailsBase: companyBase,
        leadTypes: tags,
        contact: await prepareContact({
          ...contact,
          research,
          linkedinUrl: normalizeLinkedinProfileUrl(contact.linkedinUrl)
        })
      });
    } catch (error) {
      if (error.name !== "AbortError") showSnackbar({
        type: "error",
        message: error.message || "Unable to save lead."
      });
      return null;
    } finally {
      setPreparing(false);
    }
  }
  function submit(event) {
    event.preventDefault();
    const patch = {
      contact,
      preferredChannel,
      followUpOn: closed ? null : followUpOn || null,
      followUpTask: closed ? "" : followUpTask,
      status,
      ...(!lead && draftActivity ? {
        action: draftActivity
      } : {})
    };
    void savePatch(patch);
  }
  function renderContactField(key) {
    if (key === "gender") return <Autocomplete key={key} freeSolo options={["Male", "Female", "Non-binary", "Prefer not to say"]}
      inputValue={contact.gender} value={contact.gender || null} disabled={saving || preparing}
      onInputChange={(_, value) => setContact(current => ({...current, gender: value}))}
      onChange={(_, value) => setContact(current => ({...current, gender: value || ""}))}
      renderInput={params => <TextField {...params} label="Gender" required={requiredFields.includes("gender")} helperText="Select or enter a value for email greetings; leave blank if unknown." slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, maxLength: 50}}} />} />;

    if (key === "salutation") return <Autocomplete key={key} freeSolo options={["Mr.", "Ms.", "Mrs.", "Mx.", "Dr.", "Prof.", "Prof. Dr."]}
      inputValue={contact.salutation} value={contact.salutation || null} disabled={saving || preparing}
      onInputChange={(_, value) => setContact(current => ({...current, salutation: value}))}
      onChange={(_, value) => setContact(current => ({...current, salutation: value || ""}))}
      renderInput={params => <TextField {...params} label="Salutation" required={requiredFields.includes("salutation")} helperText="Select or enter a title, e.g. Mr., Ms., or Dr." slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, maxLength: 50, autoComplete: "honorific-prefix"}}} />} />;

    if (key === "company") return <Box key={key} sx={{display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0}}>
      <Autocomplete sx={{minWidth: 0, flex: 1}} freeSolo disableClearable={Boolean(companyId)} options={companyNames} inputValue={contact.company} value={null} disabled={saving || preparing}
        onInputChange={(_, value, reason) => {
          if (reason === "input" || reason === "clear") setContact(current => ({...current, company: value}));
        }} onChange={(_, value, reason) => selectCompany(value, reason)}
        renderInput={params => <TextField {...params} label="Company" required={requiredFields.includes("company") || Boolean(companyId)}
          helperText={companyId ? "Editing this name renames the linked company for all its contacts." : "Type a new company name or select an existing company to inherit its details."}
          slotProps={{...params.slotProps, htmlInput: {...params.slotProps.htmlInput, maxLength: 200}}} />} />
      {companyId && <LeadIconButton type="button" aria-label="Unlink company" title="Unlink company and clear its details from this form" disabled={saving || preparing} onClick={unlinkCompany} sx={{mt: 1}}><Unlink size={20} /></LeadIconButton>}
    </Box>;
    const field = <LeadField sx={{ minWidth: 0, flex: 1 }} required={requiredFields.includes(key) || (key === "firstName" && !contact.lastName.trim())} autoComplete={key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : undefined} type={key === "email" ? "email" : key === "phone" ? "tel" : ["website", "detailsSource"].includes(key) ? "url" : "text"} maxLength={["linkedinUrl", "website", "detailsSource"].includes(key) ? 2000 : 200} placeholder={key === "linkedinUrl" ? "https://www.linkedin.com/in/…" : undefined} aria-invalid={key === "linkedinUrl" ? Boolean(linkedin.error) : undefined} aria-describedby={key === "linkedinUrl" && linkedin.error ? linkedinHelpId : undefined} onPaste={key === "linkedinUrl" ? event => {
      const target = event.currentTarget;
      const pasted = target.value.slice(0, target.selectionStart) + event.clipboardData.getData("text") + target.value.slice(target.selectionEnd);
      const result = linkedinProfileState(pasted);
      if (!result.error) {
        event.preventDefault();
        target.setCustomValidity("");
        setContact(current => ({
          ...current,
          linkedinUrl: result.url
        }));
      }
    } : undefined} onBlur={key === "linkedinUrl" ? event => {
      const result = linkedinProfileState(event.target.value);
      event.target.setCustomValidity(result.error);
      if (!result.error) setContact(current => ({
        ...current,
        linkedinUrl: result.url
      }));
    } : undefined} value={contact[key]} onChange={event => {
      if (key === "linkedinUrl") event.target.setCustomValidity(linkedinProfileState(event.target.value).error);
      setContact(current => ({
        ...current,
        [key]: event.target.value
      }));
    }} key={key} label={<>
                {LABELS[key]}
                </>} helperText={<>
                {key === "detailsSource" && <small className={styles.muted}>Where you found this contact. AI research can use this link as a starting point.</small>}
                {key === "linkedinUrl" && linkedin.error && <small id={linkedinHelpId} role={linkedin.error ? "alert" : undefined} className={linkedin.error ? outreach.fieldError : styles.muted}>
                  {linkedin.error}
                </small>}
              </>}></LeadField>;
    if (key !== "linkedinUrl") return field;
    return <Box key={key} sx={{ display: "flex", alignItems: "flex-start", gap: 1, minWidth: 0 }}>
      {field}
      <Box sx={{ pt: 1 }}>
        <LinkedInProfileButton value={contact.linkedinUrl} />
      </Box>
    </Box>;
  }
  const actions = <div className={outreach.dialogActions}>
      {onDelete && <LeadButton type="button" disabled={saving || preparing} onClick={onDelete} variant="outlined" color="error">Delete lead</LeadButton>}
      {onCancel && <LeadButton type="button" disabled={saving || preparing} onClick={onCancel} variant="outlined">Cancel</LeadButton>}
      <LeadButton type="submit" form={formId} disabled={saving || preparing} variant="contained">{saving || preparing ? "Saving…" : lead ? "Save changes" : "Create lead"}</LeadButton>
    </div>;
  return <>
    <form id={formId} onSubmit={submit} className={`${outreach.form} ${outreach.leadForm}`}>
      {missingLeadFields(contact, tags, requiredFields).length > 0 && <Alert severity="warning" role="status">Required before saving: {missingLeadFields(contact, tags, requiredFields).map(key => LEAD_REQUIREMENT_FIELDS[key]).join(", ")}.</Alert>}
      <LeadScope disabled={saving || preparing}>
        <Paper component="section" variant="outlined" aria-label="Contact details" sx={{
          p: {
            xs: 2,
            sm: 3
          },
          display: "grid",
          gap: 2
        }}>
        <div className={outreach.sectionIntro}>
          <Typography component="h3" variant="subtitle1">Contact details</Typography>
          <Typography className={styles.muted} component="p" variant="body2">Complete the fields marked *. Additional Apollo requirements are shown in Apollo sync & sequences.</Typography>
        </div>
        <div className={outreach.contactIdentity}>
          <div className={outreach.contactPortrait}>
            <LeadPhotoEditor name={[contact.firstName, contact.lastName].filter(Boolean).join(" ")} photoUrl={contact.photoUrl}
              disabled={saving || preparing} onChange={photoUrl => setContact(current => ({...current, photoUrl}))} />
          </div>
          <div className={outreach.grid}>
            {["firstName", "lastName", "salutation", "gender"].map(renderContactField)}
          </div>
        </div>
        <div className={outreach.grid}>
          {["company", "role", "email", "phone", "linkedinUrl"].map(renderContactField)}
        </div>

        {lead?.nameNeedsReview && <Typography className={styles.muted} component="p" variant="body2">Check the first and last name; the existing full name was split automatically.</Typography>}
        <LeadContactType required={requiredFields.includes("leadTypes")} value={tags} options={leadTypes} onChange={setTags} disabled={saving || preparing} />
        <LeadSource value={contact.source} onChange={source => setContact(current => ({
            ...current,
            source
          }))} />
        </Paper>
        <LeadAccordion>
          <DisclosureSummary><strong>Company Details</strong><small>Products, industry &amp; applications, website &amp; address</small></DisclosureSummary>
          <div className={outreach.toolContent}>
            <Typography variant="body2" color="text.secondary">Select a saved company to inherit its website, products, industry &amp; applications, and address. Saving updates the company record and all leads linked to it.</Typography>
            <Typography variant="body2" color="text.secondary">{companyId ? "Linked to a saved company." : companies.some(item => companyKey(item.name) === companyKey(contact.company)) ? "This lead is not linked yet. Reselect the company name to inherit its saved details, then save this lead." : "Saving this lead will create a company record from these details."}</Typography>
            <CompanyFields contact={contact} disabled={saving || preparing} onChange={(key, values) => setContact(current => ({
              ...current,
              [key]: values,
              ...(key === "applications" ? {industries: values} : {})
            }))} />
            <div className={outreach.grid}>
              {["website", "detailsSource"].map(renderContactField)}
            </div>
        <LeadAccordion>
          <DisclosureSummary>Address &amp; location {!requiredFields.some(key => key.startsWith("address.")) && <small className={styles.muted}>(optional)</small>}</DisclosureSummary>
          <Typography className={outreach.addressPreview} component="p" variant="body2">{formatAddress(contact.address || {}) || contact.location || "No address added"}</Typography>
          <div className={outreach.addressContent}>
        <AddressFields address={contact.address || normalizeAddress()} legacyLocation={contact.address ? "" : contact.location} onChange={address => setContact(current => ({
                  ...current,
                  address,
                  location: formatAddress(address)
                }))} />

        <section aria-label="Contact map" className={outreach.contactMap}>
          <Typography component="h3" variant="subtitle1">Contact location</Typography>
          <Typography className={styles.muted} component="p" variant="body2">{contact.location || (lead?.source?.type !== "manual" && lead?.tracking ? "Approximate location from the inbound request." : "Add an address to locate this contact.")}</Typography>
          <LeadMap activeLeadId={mapLeads[0].id} leads={mapLeads} geocode={!formatAddress(contact.address || {})} emptyMessage={geocodeMessage || undefined} />
          {geocodeMessage && <Alert role="status" severity="info">{geocodeMessage}</Alert>}
          {needsGeocoding && geocodeMessage !== "Locating address…" && <LeadButton type="button" onClick={retry} variant="outlined">Retry address lookup</LeadButton>}
        </section>
          </div>
        </LeadAccordion>

        <div className={outreach.researchLinks}>
          <LeadButton href={`https://www.linkedin.com/search/results/people/?keywords=${query}`} target="_blank" rel="noopener noreferrer" component="a">Find on LinkedIn ↗</LeadButton>
          {linkedin.url && <LeadButton href={linkedin.url} target="_blank" rel="noopener noreferrer" component="a">Open profile ↗</LeadButton>}
          <LeadButton href={`https://www.google.com/search?q=${query}%20contact`} target="_blank" rel="noopener noreferrer" component="a">Search Google ↗</LeadButton>
          {lead?.email && <LeadButton href={`mailto:${encodeURIComponent(lead.email)}`} component="a">Write email</LeadButton>}
        </div>
          </div>
        </LeadAccordion>

        <section className={outreach.leadTools} aria-label="Contact tools">
          <div className={outreach.sectionIntro}>
            <Typography component="h3" variant="subtitle1">Contact tools</Typography>
            <Typography className={styles.muted} component="p" variant="body2">Open a tool to find details, research this lead, or send it to Apollo.</Typography>
          </div>
          <LeadAccordion>
            <DisclosureSummary><strong>1. Find email, phone &amp; photo</strong><small>Look up contact details with Apollo and review the results.</small></DisclosureSummary>
            <div className={outreach.toolContent}>
        <ApolloEnrichment key={JSON.stringify([contact.firstName, contact.lastName, contact.company, contact.linkedinUrl])} settings={apolloSettings} contact={{
                firstName: contact.firstName,
                lastName: contact.lastName,
                company: contact.company,
                linkedinUrl: contact.linkedinUrl,
                email: contact.email,
                phone: contact.phone,
                photoUrl: contact.photoUrl
              }} onApplyPhoto={photoUrl => setContact(current => ({...current, photoUrl}))} onApplyPhone={phone => setContact(current => ({
                ...current,
                phone
              }))} onApply={email => setContact(current => ({
                ...current,
                email
              }))} />
            </div>
          </LeadAccordion>
          <LeadAccordion>
            <DisclosureSummary><strong>2. Research company &amp; person</strong><small>{research ? "Review saved research or refresh it with AI." : "Find company facts, experience, and sources with AI."}</small></DisclosureSummary>
            <div className={outreach.toolContent}>
        <ContactResearch contact={contact} value={research} onChange={setResearch} onCategoriesChange={categories => setContact(current => ({
                ...current,
                ...categories
              }))} />
            </div>
          </LeadAccordion>
          <LeadAccordion>
            <DisclosureSummary><strong>3. Apollo sync &amp; sequencing</strong><small>Sync contact details, view sequence progress, and manage enrollment.</small></DisclosureSummary>
            <div className={outreach.toolContent}>
              {apolloSettings?.available && apolloSettings.listEnabled ? <ApolloOutreach key={lead?.id || "new"} leadId={lead?.id} apollo={lead?.apollo} contact={contact} categories={tags} settings={apolloSettings} /> : <Typography className={styles.muted} component="p" variant="body2">{!apolloSettings ? "Loading Apollo settings…" : apolloSettings.error || <>Enable the list action in <Link href="/admin/integrations">Integrations → Apollo</Link> to send contacts.</>}</Typography>}
            </div>
          </LeadAccordion>
        </section>

        <LeadAccordion>
          <DisclosureSummary><strong>Activity &amp; notes</strong><small>{draftActivity ? "An activity is ready to save with this lead." : "Log calls, messages, meetings, and review past interactions."}</small></DisclosureSummary>
          <section aria-label="Activity history" className={`${outreach.toolContent} ${outreach.activitySection}`}>
          <div className={outreach.sectionHeader}>
            <Typography component="h3" variant="subtitle1">{lead ? "Activity history" : "First activity"}</Typography>
            <LeadButton type="button" onClick={() => setActivityOpen(true)} variant="outlined">{draftActivity ? "Edit activity" : "Add activity"}</LeadButton>
          </div>
          {!draftActivity && <Typography className={styles.muted} component="p" variant="body2">{lead ? "Calls, messages, meetings, and notes." : "Optional. Log an interaction to set the follow-up automatically."}</Typography>}
          {draftActivity && <div className={outreach.form}>
            <Typography component="p" variant="body2"><strong>{ACTIVITY_TYPES[draftActivity.type]}</strong> · {draftActivity.occurredOn} · {CHANNELS[draftActivity.channel]}</Typography>
            {draftActivity.text && <Typography style={{
                whiteSpace: "pre-wrap"
              }} component="p" variant="body2">{draftActivity.text}</Typography>}
            <Typography className={styles.muted} component="p" variant="body2">Ready to save with this lead.{!closed && followUpOn ? ` Follow-up: ${followUpOn}.` : " No follow-up reminder."}</Typography>
            <div className={styles.buttonRow}><LeadButton type="button" onClick={removeDraftActivity} variant="outlined">Remove activity</LeadButton></div>
          </div>}
          {children}
          </section>
        </LeadAccordion>

        <LeadAccordion>
          <DisclosureSummary><strong>Follow-up &amp; status</strong><small>{LEAD_STATUS_OPTIONS.find(option => option.value === status)?.label}{followUpOn && !closed ? ` · Follow-up ${followUpOn}` : " · No reminder"}</small></DisclosureSummary>
          <div className={`${outreach.form} ${outreach.toolContent}`}>
        <div className={outreach.grid}>
          <LeadField value={preferredChannel} onChange={event => {
                markManual("preferredChannel");
                setPreferredChannel(event.target.value);
              }} label={<>Preferred channel
            </>} select={true}>
              {Object.entries(CHANNELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </LeadField>
          <LeadField value={status} onChange={event => {
                markManual("status");
                setStatus(event.target.value);
              }} label={<>Lead status
            </>} select={true}>
              {LEAD_STATUS_OPTIONS.filter(option => option.value !== "pending_verification" || lead?.status === "pending_verification").map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </LeadField>

        </div>

          {closed ? <Typography className={styles.muted} component="p" variant="body2">Closing this lead clears its follow-up reminder.</Typography> : <>
            <div className={outreach.grid}>
              <LeadField type="date" value={followUpOn} onChange={event => {
                  markManual("followUpOn");
                  setFollowUpOn(event.target.value);
                }} label={<>Follow-up date
                </>}></LeadField>
              <LeadField maxLength={500} value={followUpTask} onChange={event => setFollowUpTask(event.target.value)} placeholder="For example, send my profile after acceptance" label={<>Next step
                </>}></LeadField>
            </div>
            <div className={styles.buttonRow}>
              <LeadButton type="button" onClick={() => {
                  markManual("followUpOn");
                  setFollowUpOn(suggestion || addDays(localDay(), 5));
                }} variant="outlined">{suggestion ? `Use suggested date (${suggestion})` : "5 days after today"}</LeadButton>
              <LeadButton type="button" onClick={() => {
                  markManual("followUpOn");
                  setFollowUpOn("");
                  setFollowUpTask("");
                }} variant="outlined">Clear reminder</LeadButton>
            </div>
            <Typography className={styles.muted} component="p" variant="body2">Outreach suggests five calendar days. Adjust the date or clear it when no follow-up is needed. Reminders appear in your lead list.</Typography>
          </>}
          </div>
        </LeadAccordion>
        {!lead && !footerTarget && actions}
      </LeadScope>
    </form>
    {footerTarget && createPortal(actions, footerTarget)}
    {activityOpen && <ActivityModal lead={{
      ...lead,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(" "),
      status,
      followUpOn
    }} saving={saving || preparing} draft={!lead} initialAction={draftActivity} onClose={() => setActivityOpen(false)} onSave={patch => {
      if (lead) return savePatch({
        contact,
        status,
        preferredChannel,
        followUpTask,
        ...patch
      });
      setDraftActivity(patch.action);
      if (!manualDefaults.status) setStatus(suggestedActivityStatus("pending", patch.action));
      if (!manualDefaults.preferredChannel) setPreferredChannel(patch.action.channel === "other" ? "linkedin" : patch.action.channel);
      setFollowUpOn(patch.followUpOn || "");
      return true;
    }} />}
    </>;
}
