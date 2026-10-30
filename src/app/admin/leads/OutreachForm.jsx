"use client";

import {LEAD_STATUS_OPTIONS, CLOSED_STATUSES} from "../../lib/leadStatuses.mjs";
import {useId, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {ACTIVITY_TYPES, CHANNELS, CONTACT_FIELDS, addDays, localDay, suggestedFollowUp, suggestedActivityStatus} from "../../lib/leadOutreach.mjs";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import styles from "../admin.module.css";
import DisclosureSummary from "./DisclosureSummary";
import outreach from "./outreach.module.css";
import ActivityModal from "./ActivityModal";
import ContactResearch from "./ContactResearch";
import {researchCategories} from "../../lib/contactResearch.mjs";
import LeadMap from "./LeadMap";
import useContactGeocoding from "./useContactGeocoding";
import LeadTagsAutocomplete from "./LeadTagsAutocomplete";
import {getLeadTypes} from "../../lib/leadTypes.mjs";
import {linkedinProfileState, normalizeLinkedinProfileUrl} from "../../lib/linkedinProfile.mjs";
import AddressFields from "./AddressFields";
import {formatAddress, normalizeAddress} from "../../lib/leadAddress.mjs";

const LABELS = {firstName: "First name", lastName: "Last name", company: "Company", role: "Role / job title", location: "Contact address / city", email: "Email", phone: "Phone", linkedinUrl: "LinkedIn profile URL", website: "Company website", detailsSource: "Source link (optional)"};

export default function OutreachForm({lead, saving, onSave, onCancel, onDelete, footerTarget, children, companyNames = [], leadTypes = []}) {
  const {showSnackbar} = useSnackbar();
  const formId = useId();
  const companiesId = useId();
  const [tags, setTags] = useState(() => getLeadTypes(lead));
  const [research, setResearch] = useState(lead?.research || null);
  const [contact, setContact] = useState(() => ({...Object.fromEntries(CONTACT_FIELDS.map((key) => [key, lead?.[key] || ""])), industries: lead?.industries ?? researchCategories(lead?.research).industries, products: lead?.products ?? researchCategories(lead?.research).products, ...(lead?.address ? {address: normalizeAddress(lead.address)} : {})}));
  const linkedin = linkedinProfileState(contact.linkedinUrl);
  const linkedinHelpId = useId();
  const {message: geocodeMessage, prepareContact, retry, needsGeocoding} = useContactGeocoding(contact, setContact);
  const [preparing, setPreparing] = useState(false);
  const mapLeads = useMemo(() => [{...lead, ...contact, id: lead?.id || "draft", name: [contact.firstName, contact.lastName].filter(Boolean).join(" ")}], [lead, contact]);
  const [status, setStatus] = useState(lead?.status || "pending");
  const [preferredChannel, setPreferredChannel] = useState(lead?.preferredChannel || "linkedin");
  const [activityOpen, setActivityOpen] = useState(false);
  const [draftActivity, setDraftActivity] = useState(null);
  const [manualDefaults, setManualDefaults] = useState({});
  function markManual(key) { setManualDefaults((current) => ({...current, [key]: true})); }
  function removeDraftActivity() {
    setDraftActivity(null);
    if (!manualDefaults.status) setStatus("pending");
    if (!manualDefaults.preferredChannel) setPreferredChannel("linkedin");
    if (!manualDefaults.followUpOn) setFollowUpOn("");
  }
  const [followUpOn, setFollowUpOn] = useState(lead?.followUpOn || "");
  const [followUpTask, setFollowUpTask] = useState(lead?.followUpTask || "");
  const suggestion = suggestedFollowUp({...lead, status}, draftActivity);
  const closed = CLOSED_STATUSES.includes(status);
  const query = encodeURIComponent([contact.firstName, contact.lastName, contact.company].filter(Boolean).join(" "));

  async function savePatch(patch) {
    setPreparing(true);
    try { return await onSave({...patch, leadTypes: tags, contact: await prepareContact({...contact, research, linkedinUrl: normalizeLinkedinProfileUrl(contact.linkedinUrl)})}); }
    catch (error) {
      if (error.name !== "AbortError") showSnackbar({type: "error", message: error.message || "Unable to save lead."});
      return null;
    }
    finally { setPreparing(false); }
  }

  function submit(event) {
    event.preventDefault();
    const patch = {
      contact, preferredChannel,
      followUpOn: closed ? null : followUpOn || null,
      followUpTask: closed ? "" : followUpTask,
      status,
      ...(!lead && draftActivity ? {action: draftActivity} : {}),
    };
    void savePatch(patch);
  }

  function renderContactField(key) {
    return (
              <label className={`${styles.field} ${key === "linkedinUrl" ? outreach.wide : ""}`} key={key}>
                {LABELS[key]}
                <input
                  list={key === "company" ? companiesId : undefined}
                  required={key === "firstName" && !contact.lastName.trim()}
                  autoComplete={key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : undefined}
                  type={key === "email" ? "email" : key === "phone" ? "tel" : ["website", "detailsSource"].includes(key) ? "url" : "text"}
                  maxLength={["linkedinUrl", "website", "detailsSource"].includes(key) ? 2000 : 200}
                  placeholder={key === "linkedinUrl" ? "https://www.linkedin.com/in/…" : undefined}
                  aria-invalid={key === "linkedinUrl" ? Boolean(linkedin.error) : undefined}
                  aria-describedby={key === "linkedinUrl" && linkedin.error ? linkedinHelpId : undefined}
                  onPaste={key === "linkedinUrl" ? (event) => {
                    const target = event.currentTarget;
                    const pasted = target.value.slice(0, target.selectionStart) + event.clipboardData.getData("text") + target.value.slice(target.selectionEnd);
                    const result = linkedinProfileState(pasted);
                    if (!result.error) {
                      event.preventDefault();
                      target.setCustomValidity("");
                      setContact((current) => ({...current, linkedinUrl: result.url}));
                    }
                  } : undefined}
                  onBlur={key === "linkedinUrl" ? (event) => {
                    const result = linkedinProfileState(event.target.value);
                    event.target.setCustomValidity(result.error);
                    if (!result.error) setContact((current) => ({...current, linkedinUrl: result.url}));
                  } : undefined}
                  value={contact[key]}
                  onChange={(event) => {
                    if (key === "linkedinUrl") event.target.setCustomValidity(linkedinProfileState(event.target.value).error);
                    setContact((current) => ({...current, [key]: event.target.value}));
                  }}
                />
                {key === "detailsSource" && <small className={styles.muted}>Where you found this contact. AI research can use this link as a starting point.</small>}
                {key === "linkedinUrl" && linkedin.error && <small id={linkedinHelpId} role={linkedin.error ? "alert" : undefined} className={linkedin.error ? outreach.fieldError : styles.muted}>
                  {linkedin.error}
                </small>}
              </label>
    );
  }

  const FollowUpContainer = lead ? "section" : "details";

  const actions = (
    <div className={outreach.dialogActions}>
      {onDelete && <button type="button" disabled={saving || preparing} className={styles.dangerButton} onClick={onDelete}>Delete lead</button>}
      {onCancel && <button type="button" disabled={saving || preparing} className={styles.secondaryButton} onClick={onCancel}>Cancel</button>}
      <button type="submit" form={formId} disabled={saving || preparing} className={styles.button}>{saving || preparing ? "Saving…" : lead ? "Save changes" : "Create lead"}</button>
    </div>
  );

  return (
    <>
    <form id={formId} onSubmit={submit} className={`${outreach.form} ${outreach.leadForm}`}
      onInvalidCapture={(event) => {
        // Reveal optional fields before the browser focuses a validation error.
        let details = event.target.closest("details");
        while (details) {
          details.open = true;
          details = details.parentElement?.closest("details");
        }
      }}>
      <fieldset disabled={saving || preparing} className={outreach.fieldset}>
        <section aria-label="Contact details and research" className={outreach.formSection}>
        <div className={outreach.sectionIntro}>
          <h3>Contact details</h3>
          <p className={styles.muted}>A first or last name is all you need to get started.</p>
        </div>
        <div className={outreach.grid}>
          {["firstName", "lastName", "company", "role", "email", "phone", "linkedinUrl"].map(renderContactField)}
        </div>
        <datalist id={companiesId}>
          {companyNames.map((company) => <option key={company} value={company} />)}
        </datalist>
        {lead?.nameNeedsReview && <p className={styles.muted}>Check the first and last name; the existing full name was split automatically.</p>}
        <LeadTagsAutocomplete label="Tags" value={tags} options={leadTypes} onChange={setTags}
          disabled={saving || preparing} allowCreate
          help="Choose existing tags or type a new one and press Enter." />
        <details className={outreach.additionalDetails}>
          <DisclosureSummary>More contact details <small>Website, address &amp; research</small></DisclosureSummary>
          <div className={outreach.additionalContent}>
            <div className={outreach.grid}>
              {["website", "detailsSource"].map(renderContactField)}
            </div>
        <details className={outreach.addressDetails}>
          <DisclosureSummary>Address &amp; location <small className={styles.muted}>(optional)</small></DisclosureSummary>
          <p className={outreach.addressPreview}>{formatAddress(contact.address || {}) || contact.location || "No address added"}</p>
          <div className={outreach.addressContent}>
        <AddressFields address={contact.address || normalizeAddress()}
          legacyLocation={contact.address ? "" : contact.location}
          onChange={(address) => setContact((current) => ({...current, address, location: formatAddress(address)}))} />

        <section aria-label="Contact map" className={outreach.contactMap}>
          <h3>Contact location</h3>
          <p className={styles.muted}>{contact.location || (lead?.source?.type !== "manual" && lead?.tracking ? "Approximate location from the inbound request." : "Add an address to locate this contact.")}</p>
          <LeadMap activeLeadId={mapLeads[0].id} leads={mapLeads}
            geocode={!formatAddress(contact.address || {})} emptyMessage={geocodeMessage || undefined} />
          {geocodeMessage && <p role="status" className={styles.muted}>{geocodeMessage}</p>}
          {needsGeocoding && geocodeMessage !== "Locating address…" && <button type="button" className={styles.secondaryButton} onClick={retry}>Retry address lookup</button>}
        </section>
          </div>
        </details>

        <div className={outreach.researchLinks}>
          <a className={styles.secondaryButton} href={`https://www.linkedin.com/search/results/people/?keywords=${query}`} target="_blank" rel="noopener noreferrer">Find on LinkedIn ↗</a>
          {linkedin.url && <a className={styles.secondaryButton} href={linkedin.url} target="_blank" rel="noopener noreferrer">Open profile ↗</a>}
          <a className={styles.secondaryButton} href={`https://www.google.com/search?q=${query}%20contact`} target="_blank" rel="noopener noreferrer">Search Google ↗</a>
          {lead?.email && <a className={styles.secondaryButton} href={`mailto:${encodeURIComponent(lead.email)}`}>Write email</a>}
        </div>
          </div>
        </details>
        </section>

        <ContactResearch contact={contact} value={research} onChange={setResearch} onCategoriesChange={(categories) => setContact((current) => ({...current, ...categories}))} />

        <section aria-label="Activity history" className={`${outreach.formSection} ${outreach.activitySection}`}>
          <div className={outreach.sectionHeader}>
            <h3>{lead ? "Activity history" : "First activity"}</h3>
            <button type="button" className={styles.secondaryButton} onClick={() => setActivityOpen(true)}>{draftActivity ? "Edit activity" : "Add activity"}</button>
          </div>
          {!draftActivity && <p className={styles.muted}>{lead ? "Calls, messages, meetings, and notes." : "Optional. Log an interaction to set the follow-up automatically."}</p>}
          {draftActivity && <div className={outreach.form}>
            <p><strong>{ACTIVITY_TYPES[draftActivity.type]}</strong> · {draftActivity.occurredOn} · {CHANNELS[draftActivity.channel]}</p>
            {draftActivity.text && <p style={{whiteSpace: "pre-wrap"}}>{draftActivity.text}</p>}
            <p className={styles.muted}>Ready to save with this lead.{!closed && followUpOn ? ` Follow-up: ${followUpOn}.` : " No follow-up reminder."}</p>
            <div className={styles.buttonRow}><button type="button" className={styles.secondaryButton} onClick={removeDraftActivity}>Remove activity</button></div>
          </div>}
          {children}
        </section>

        <FollowUpContainer aria-label="Follow-up and status" className={lead ? outreach.formSection : outreach.creationFollowUp}>
          {lead ? <h3>Follow-up and status</h3> : <DisclosureSummary>Follow-up and status <small className={styles.muted}>(adjust)</small></DisclosureSummary>}
          <div className={outreach.form}>
        <div className={outreach.grid}>
          <label className={styles.field}>Preferred channel
            <select value={preferredChannel} onChange={(event) => {markManual("preferredChannel"); setPreferredChannel(event.target.value);}}>
              {Object.entries(CHANNELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className={styles.field}>Lead status
            <select value={status} onChange={(event) => {markManual("status"); setStatus(event.target.value);}}>
              {LEAD_STATUS_OPTIONS.filter((option) => option.value !== "pending_verification" || lead?.status === "pending_verification")
                .map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>

          {closed ? <p className={styles.muted}>Closing this lead clears its follow-up reminder.</p> : <>
            <div className={outreach.grid}>
              <label className={styles.field}>Follow-up date
                <input type="date" value={followUpOn} onChange={(event) => {markManual("followUpOn"); setFollowUpOn(event.target.value);}} />
              </label>
              <label className={styles.field}>Next step
                <input maxLength={500} value={followUpTask} onChange={(event) => setFollowUpTask(event.target.value)} placeholder="For example, send my profile after acceptance" />
              </label>
            </div>
            <div className={styles.buttonRow}>
              <button className={styles.secondaryButton} type="button" onClick={() => {markManual("followUpOn"); setFollowUpOn(suggestion || addDays(localDay(), 5));}}>{suggestion ? `Use suggested date (${suggestion})` : "5 days after today"}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => {markManual("followUpOn"); setFollowUpOn(""); setFollowUpTask("");}}>Clear reminder</button>
            </div>
            <p className={styles.muted}>Outreach suggests five calendar days. Adjust the date or clear it when no follow-up is needed. Reminders appear in your lead list.</p>
          </>}
          </div>
        </FollowUpContainer>
        {!lead && !footerTarget && actions}
      </fieldset>
    </form>
    {footerTarget && createPortal(actions, footerTarget)}
    {activityOpen && <ActivityModal lead={{...lead, name: [contact.firstName, contact.lastName].filter(Boolean).join(" "), status, followUpOn}} saving={saving || preparing}
      draft={!lead} initialAction={draftActivity}
      onClose={() => setActivityOpen(false)}
      onSave={(patch) => {
        if (lead) return savePatch({contact, status, preferredChannel, followUpTask, ...patch});
        setDraftActivity(patch.action);
        if (!manualDefaults.status) setStatus(suggestedActivityStatus("pending", patch.action));
        if (!manualDefaults.preferredChannel) setPreferredChannel(patch.action.channel === "other" ? "linkedin" : patch.action.channel);
        setFollowUpOn(patch.followUpOn || "");
        return true;
      }} />}
    </>
  );
}
