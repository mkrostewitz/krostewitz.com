"use client";

import {useId, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {CHANNELS, CONTACT_FIELDS, addDays, localDay, suggestedFollowUp} from "../../lib/leadOutreach.mjs";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";
import ActivityModal from "./ActivityModal";
import LeadMap from "./LeadMap";
import useContactGeocoding from "./useContactGeocoding";
import AddressFields from "./AddressFields";
import {formatAddress, normalizeAddress} from "../../lib/leadAddress.mjs";

const LABELS = {firstName: "First name", lastName: "Last name", company: "Company", role: "Role / job title", location: "Contact address / city", email: "Email", phone: "Phone", linkedinUrl: "LinkedIn profile URL", website: "Company website", detailsSource: "Contact details source URL"};

export default function OutreachForm({lead, saving, onSave, onCancel, onDelete, footerTarget, children}) {
  const formId = useId();
  const [contact, setContact] = useState(() => ({...Object.fromEntries(CONTACT_FIELDS.map((key) => [key, lead?.[key] || ""])), ...(lead?.address ? {address: normalizeAddress(lead.address)} : {})}));
  const {message: geocodeMessage, prepareContact, retry, needsGeocoding} = useContactGeocoding(contact, setContact);
  const [preparing, setPreparing] = useState(false);
  const mapLeads = useMemo(() => [{...lead, ...contact, id: lead?.id || "draft", name: [contact.firstName, contact.lastName].filter(Boolean).join(" ")}], [lead, contact]);
  const [status, setStatus] = useState(lead?.status || "pending");
  const [preferredChannel, setPreferredChannel] = useState(lead?.preferredChannel || "linkedin");
  const [activityOpen, setActivityOpen] = useState(false);
  const [followUpOn, setFollowUpOn] = useState(lead?.followUpOn || "");
  const [followUpTask, setFollowUpTask] = useState(lead?.followUpTask || "");
  const suggestion = suggestedFollowUp(lead);
  const closed = ["won", "lost"].includes(status);
  const query = encodeURIComponent([contact.firstName, contact.lastName, contact.company].filter(Boolean).join(" "));

  async function savePatch(patch) {
    setPreparing(true);
    try { return await onSave({...patch, contact: await prepareContact(contact)}); }
    catch (error) { if (error.name !== "AbortError") throw error; return null; }
    finally { setPreparing(false); }
  }

  function submit(event) {
    event.preventDefault();
    const patch = {
      contact, preferredChannel,
      followUpOn: closed ? null : followUpOn || null,
      followUpTask: closed ? "" : followUpTask,
      ...(lead ? {status} : {}),

    };
    void savePatch(patch);
  }

  const actions = (
    <div className={lead ? outreach.dialogActions : styles.buttonRow}>
      {onDelete && <button type="button" disabled={saving || preparing} className={styles.dangerButton} onClick={onDelete}>Delete lead</button>}
      {onCancel && <button type="button" disabled={saving || preparing} className={styles.secondaryButton} onClick={onCancel}>Cancel</button>}
      <button type="submit" form={formId} disabled={saving || preparing} className={styles.button}>{saving || preparing ? "Saving…" : lead ? "Save changes" : "Create lead"}</button>
    </div>
  );

  return (
    <>
    <form id={formId} onSubmit={submit} className={outreach.form}>
      <fieldset disabled={saving || preparing} className={outreach.fieldset}>
        <section aria-label="Contact details and research" className={outreach.formSection}>
        <h3>Contact</h3>
        <details open={!lead} className={outreach.contactDetails}>
          <summary>Contact details {lead ? "— edit" : ""}</summary>
          <div className={outreach.grid}>
            {CONTACT_FIELDS.filter((key) => key !== "location").map((key) => (
              <label className={styles.field} key={key}>
                {LABELS[key]}
                <input
                  required={key === "firstName" && !contact.lastName.trim()}
                  autoComplete={key === "firstName" ? "given-name" : key === "lastName" ? "family-name" : undefined}
                  type={key === "email" ? "email" : key === "phone" ? "tel" : ["linkedinUrl", "website", "detailsSource"].includes(key) ? "url" : "text"}
                  maxLength={["linkedinUrl", "website", "detailsSource"].includes(key) ? 2000 : 200}
                  placeholder={key === "linkedinUrl" ? "https://www.linkedin.com/in/…" : undefined}
                  value={contact[key]}
                  onChange={(event) => setContact((current) => ({...current, [key]: event.target.value}))}
                />
              </label>
            ))}
          </div>
          {lead?.nameNeedsReview && <p className={styles.muted}>The existing name was split automatically. Check the first and last name before saving.</p>}
          <p className={styles.muted}>Start with a first or last name; email and phone are optional. Save a source link when adding researched contact details.</p>
        </details>

        <details className={outreach.addressDetails}>
          <summary>Address &amp; location <small className={styles.muted}>(optional)</small></summary>
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

        <div className={styles.buttonRow}>
          <a className={styles.secondaryButton} href={`https://www.linkedin.com/search/results/people/?keywords=${query}`} target="_blank" rel="noopener noreferrer">Find on LinkedIn ↗</a>
          {lead?.linkedinUrl && <a className={styles.secondaryButton} href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer">Open profile ↗</a>}
          <a className={styles.secondaryButton} href={`https://www.google.com/search?q=${query}%20contact`} target="_blank" rel="noopener noreferrer">Research contact ↗</a>
          {lead?.email && <a className={styles.secondaryButton} href={`mailto:${encodeURIComponent(lead.email)}`}>Write email</a>}
        </div>
        </section>

        {lead && <section aria-label="Activity history" className={outreach.formSection}>
          <div className={outreach.sectionHeader}>
            <h3>Activity history</h3>
            <button type="button" className={styles.button} onClick={() => setActivityOpen(true)}>Add activity</button>
          </div>
          <p className={styles.muted}>Record calls, messages, and meetings to keep the history and next follow-up up to date.</p>
          {children}
        </section>}

        <section aria-label="Follow-up and status" className={outreach.formSection}>
          <h3>Follow-up and status</h3>
        <div className={outreach.grid}>
          <label className={styles.field}>Preferred channel
            <select value={preferredChannel} onChange={(event) => setPreferredChannel(event.target.value)}>
              {Object.entries(CHANNELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          {lead && <label className={styles.field}>Lead status
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              {lead.status === "pending_verification" && <option value="pending_verification">Pending verification</option>}
              <option value="pending">Pending</option><option value="won">Won</option><option value="lost">Lost</option>
            </select>
          </label>}
        </div>

          {closed ? <p className={styles.muted}>Closing this lead clears its follow-up reminder.</p> : <>
            <div className={outreach.grid}>
              <label className={styles.field}>Follow-up date
                <input type="date" value={followUpOn} onChange={(event) => {setFollowUpOn(event.target.value);}} />
              </label>
              <label className={styles.field}>Next step
                <input maxLength={500} value={followUpTask} onChange={(event) => setFollowUpTask(event.target.value)} placeholder="For example, send my profile after acceptance" />
              </label>
            </div>
            <div className={styles.buttonRow}>
              <button className={styles.secondaryButton} type="button" onClick={() => {setFollowUpOn(suggestion || addDays(localDay(), 5));}}>{suggestion ? `Use suggested date (${suggestion})` : "5 days after today"}</button>
              <button className={styles.secondaryButton} type="button" onClick={() => {setFollowUpOn(""); setFollowUpTask("");}}>Clear reminder</button>
            </div>
            <p className={styles.muted}>Outreach suggests five calendar days. Adjust the date or clear it when no follow-up is needed. Reminders appear in your lead list.</p>
          </>}
        </section>
        {!lead && actions}
      </fieldset>
    </form>
    {lead && footerTarget && createPortal(actions, footerTarget)}
    {activityOpen && <ActivityModal lead={{...lead, status}} saving={saving || preparing}
      onClose={() => setActivityOpen(false)}
      onSave={(patch) => savePatch({contact, status, preferredChannel, followUpTask, ...patch})} />}
    </>
  );
}
