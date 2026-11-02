"use client";

import {useEffect, useRef} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import styles from "../admin.module.css";
import ui from "./integrations.module.css";

const permissions = [
  ["Enrich contacts", ["api/v1/people/match"]],
  ["Retrieve phone results (optional)", ["api/v1/webhook_result/show"]],
  ["Browse and create contact lists (optional)", ["api/v1/labels/index", "api/v1/labels/create"]],
  ["Add to an Apollo list (optional)", ["api/v1/contacts/bulk_create", "api/v1/labels/add_entity_ids_to_label_names"]],
  ["Choose sequences and sending accounts (optional)", ["api/v1/emailer_campaigns/search", "api/v1/email_accounts/index"]],
  ["Read sequence progress and contact stage (optional)", ["api/v1/contacts/show", "api/v1/contact_stages/index", "api/v1/emailer_campaigns/search"]],
  ["Enroll in a sequence (optional)", ["api/v1/emailer_campaigns/add_contact_ids"]],
];

export default function ApolloSetupHelp({onClose}) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      previousFocus?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialog} className={ui.helpDialog} aria-labelledby="apollo-setup-title"
    onCancel={(event) => {event.preventDefault(); onClose();}}>
    <div className={ui.helpHeader}>
      <div><h2 id="apollo-setup-title">Set up Apollo</h2><p>Connect your account in four steps.</p></div>
      <button type="button" className={styles.iconButton} onClick={onClose} aria-label="Close Apollo setup guide" autoFocus><X size={20} aria-hidden="true" /></button>
    </div>
    <div className={ui.helpBody}>
      <ol className={ui.steps}>
        <li><h3>Create your Apollo account</h3>
          <p>Visit <a href="https://www.apollo.io/" target="_blank" rel="noreferrer">Apollo.io ↗</a>, choose Sign up, and complete account setup using your work email. Already have an account? Sign in to that workspace.</p>
          <p>Free accounts need a work email for people enrichment. API access and available credits depend on your account.</p>
        </li>
        <li><h3>Create a scoped API key</h3>
          <p>In Apollo, go to <strong>Settings → Integrations → API Keys</strong>, then <strong>Create new key</strong>. Give it a recognizable name, such as “Website leads”. You need an admin account or permission to create API keys.</p>
          <p>Select only the endpoints for the features you will use below. Leave <strong>Set as master key</strong> off.</p>
          <div className={ui.permissions}>
            {permissions.map(([label, endpoints]) => <div key={label}><strong>{label}</strong>{endpoints.map((endpoint) => <code key={endpoint}>{endpoint}</code>)}</div>)}
          </div>
          <p><a href="https://docs.apollo.io/docs/create-api-key" target="_blank" rel="noreferrer">Apollo’s API key instructions ↗</a></p>
        </li>
        <li><h3>Connect it here</h3>
          <p>Click <strong>Create API key</strong> in Apollo and copy the key. Close this guide, paste it into <strong>API key</strong>, turn on <strong>Enable Apollo</strong>, and save. The key is stored encrypted and is never displayed again.</p>
          <p>Open a lead, enter a LinkedIn profile or a name and company, then click <strong>Enrich contact</strong>. Review the match and apply the email before saving. Lookups can use credits even when no email is returned. Select Include phone number for an optional phone lookup; additional credits may apply. Phone results can take a few minutes. Review a number and choose Use this phone before saving.</p>
        </li>
        <li><h3>Add optional list and sequence actions</h3>
          <p>Enable <strong>Add to an Apollo list</strong>, choose an existing contact list or create one here, then save settings. Creating a list takes effect immediately in Apollo. Your lead categories are added as additional labels. Existing Apollo labels are preserved. Enrichment and saving a lead do not add anyone automatically.</p>
          <p>For sequences, create your sequence and connect a sending mailbox in Apollo first. Save your API key here first, then enable <strong>Sequence enrollment</strong> and choose a sending account. Each lead category, such as Recruiter or Interim Firm, has its own sequence dropdown. Choose a sequence for each category you want to enroll. The first matching rule wins. An optional fallback handles unmatched leads; without one, those leads are added to the list only. Select enrollment separately for each lead; it can start sending emails according to the sequence schedule.</p>
          <p>The dropdowns require <code>api/v1/emailer_campaigns/search</code> and <code>api/v1/email_accounts/index</code>. If access is denied, grant these permissions to your saved key and click <strong>Refresh</strong>. Use <strong>Load more sequences</strong> if your sequence is on a later page.</p>
          <p><a href="https://docs.apollo.io/reference/search-for-sequences" target="_blank" rel="noreferrer">Sequence lookup documentation</a> · <a href="https://docs.apollo.io/reference/get-a-list-of-email-accounts" target="_blank" rel="noreferrer">Sending account lookup documentation</a></p>
        </li>
      </ol>
      <details className={ui.troubleshooting}><summary>Having trouble?</summary>
        <p><strong>Cannot create a key:</strong> ask your Apollo workspace admin for access.</p>
        <p><strong>Access denied:</strong> check the selected endpoint permissions and your account’s access to the feature.</p>
        <p><strong>No email found:</strong> add more identifying details and check the LinkedIn URL. Apollo may not have a work email for that person.</p>
        <p><strong>Sequence skipped:</strong> check Apollo’s result for email verification, existing enrollment or sender access. This integration keeps Apollo’s enrollment checks enabled.</p>
      </details>
    </div>
    <div className={ui.helpFooter}><button type="button" className={styles.button} onClick={onClose}>Back to settings</button></div>
  </dialog>, document.body);
}
