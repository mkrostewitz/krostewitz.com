"use client";

import { Autocomplete, TextField, Paper, Typography, Alert, MenuItem } from "@mui/material";
import { LeadField, LeadButton, LeadAccordion, LeadScope } from "./LeadUi";
import { LEAD_STATUS_OPTIONS, CLOSED_STATUSES } from "../../lib/leadStatuses.mjs";
import { useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ACTIVITY_TYPES, CHANNELS, CONTACT_FIELDS, addDays, localDay, suggestedFollowUp, suggestedActivityStatus } from "../../lib/leadOutreach.mjs";
import { useSnackbar } from "./LeadSnackbar";
import styles from "../admin.module.css";
import DisclosureSummary from "./DisclosureSummary";
import outreach from "./outreach.module.css";
import ActivityModal from "./ActivityModal";
import ContactResearch from "./ContactResearch";
import { researchCategories } from "../../lib/contactResearch.mjs";
import LeadMap from "./LeadMap";
import useContactGeocoding from "./useContactGeocoding";
import LeadTagsAutocomplete from "./LeadTagsAutocomplete";
import { getLeadTypes } from "../../lib/leadTypes.mjs";
import { linkedinProfileState, normalizeLinkedinProfileUrl } from "../../lib/linkedinProfile.mjs";
import AddressFields from "./AddressFields";
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
  leadTypes = []
}) {
  const {
    showSnackbar
  } = useSnackbar();
  const formId = useId();
  const [tags, setTags] = useState(() => getLeadTypes(lead));
  const [research, setResearch] = useState(lead?.research || null);
  const [contact, setContact] = useState(() => ({
    ...Object.fromEntries(CONTACT_FIELDS.map(key => [key, lead?.[key] || ""])),
    industries: lead?.industries ?? researchCategories(lead?.research).industries,
    products: lead?.products ?? researchCategories(lead?.research).products,
    ...(lead?.address ? {
      address: normalizeAddress(lead.address)
    } : {})
  }));
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
      return await onSave({
        ...patch,
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
    if (key === "company") return <Autocomplete key={key} freeSolo options={companyNames} inputValue={contact.company} value={contact.company || null} disabled={saving || preparing} onInputChange={(_, value) => setContact(current => ({
      ...current,
      company: value
    }))} onChange={(_, value) => setContact(current => ({
      ...current,
      company: value || ""
    }))} renderInput={params => <TextField {...params} label="Company" slotProps={{
      ...params.slotProps,
      htmlInput: {
        ...params.slotProps.htmlInput,
        maxLength: 200
      }
    }} />} />;
    const field = <LeadField sx={{ minWidth: 0, flex: 1 }} required={(key === "firstName" && !contact.lastName.trim())} autoComplete={key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : undefined} type={key === "email" ? "email" : key === "phone" ? "tel" : ["website", "detailsSource"].includes(key) ? "url" : "text"} maxLength={["linkedinUrl", "website", "detailsSource"].includes(key) ? 2000 : 200} placeholder={key === "linkedinUrl" ? "https://www.linkedin.com/in/…" : undefined} aria-invalid={key === "linkedinUrl" ? Boolean(linkedin.error) : undefined} aria-describedby={key === "linkedinUrl" && linkedin.error ? linkedinHelpId : undefined} onPaste={key === "linkedinUrl" ? event => {
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
    return field;
  }
  const actions = <div className={outreach.dialogActions}>
      {onDelete && <LeadButton type="button" disabled={saving || preparing} onClick={onDelete} variant="outlined" color="error">Delete lead</LeadButton>}
      {onCancel && <LeadButton type="button" disabled={saving || preparing} onClick={onCancel} variant="outlined">Cancel</LeadButton>}
      <LeadButton type="submit" form={formId} disabled={saving || preparing} variant="contained">{saving || preparing ? "Saving…" : lead ? "Save changes" : "Create lead"}</LeadButton>
    </div>;
  return <>
    <form id={formId} onSubmit={submit} className={`${outreach.form} ${outreach.leadForm}`}>
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
          <Typography className={styles.muted} component="p" variant="body2">A first or last name is all you need to get started.</Typography>
        </div>
        <div className={outreach.grid}>
          {["firstName", "lastName", "company", "role", "email", "phone", "linkedinUrl"].map(renderContactField)}
        </div>

        {lead?.nameNeedsReview && <Typography className={styles.muted} component="p" variant="body2">Check the first and last name; the existing full name was split automatically.</Typography>}
        <LeadTagsAutocomplete label="Tags" value={tags} options={leadTypes} onChange={setTags} disabled={saving || preparing} allowCreate help="Choose existing tags or type a new one and press Enter." />
        </Paper>
        <LeadAccordion>
          <DisclosureSummary><strong>More contact details</strong><small>Website, address &amp; research</small></DisclosureSummary>
          <div className={outreach.toolContent}>
            <div className={outreach.grid}>
              {["website", "detailsSource"].map(renderContactField)}
            </div>
        <LeadAccordion>
          <DisclosureSummary>Address &amp; location <small className={styles.muted}>(optional)</small></DisclosureSummary>
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

          <LeadAccordion>
            <DisclosureSummary><strong>Research company &amp; person</strong><small>{research ? "Review saved research or refresh it with AI." : "Find company facts, experience, and sources with AI."}</small></DisclosureSummary>
            <div className={outreach.toolContent}>
        <ContactResearch contact={contact} value={research} onChange={setResearch} onCategoriesChange={categories => setContact(current => ({
                ...current,
                ...categories
              }))} />
            </div>
          </LeadAccordion>


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
