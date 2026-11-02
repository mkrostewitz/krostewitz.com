"use client";

import { Tooltip, Link, Alert, Typography } from "@mui/material";
import { LeadButton, LeadIconButton, LeadCheckbox } from "./LeadUi";
import { useEffect, useRef, useState } from "react";
import { Check, CircleHelp, Mail, Sparkles } from "lucide-react";
import ApolloPhones from "./ApolloPhones";
import outreach from "./outreach.module.css";
export default function ApolloEnrichment({
  contact,
  onApply,
  onApplyPhone,
  settings
}) {
  const [includePhone, setIncludePhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function run() {
    if (controller.current || !settings?.available) return;
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/admin/leads/enrich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contact,
          includePhone
        }),
        signal: abort.signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to find an email with Apollo.");
      setResult(data.result);
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message || "Unable to find an email with Apollo.");
    } finally {
      controller.current = null;
      setBusy(false);
    }
  }
  const ready = contact.linkedinUrl.trim() || contact.firstName.trim() && contact.lastName.trim() && contact.company.trim();
  return <section aria-label="Contact enrichment" aria-busy={busy}>
    <div className={outreach.enrichmentActions}>
      <LeadButton type="button" disabled={busy || !ready || !settings?.available} onClick={run} variant="outlined">
        <Sparkles size={16} aria-hidden="true" />
        {busy ? "Enriching contact…" : "Enrich contact"}
      </LeadButton>
      <Tooltip title={!settings ? "Checking enrichment availability…" : settings.error || (!settings.available ? "Configure and enable Apollo in Integrations to enrich contacts." : !ready ? "Enter a LinkedIn profile URL, or first name, last name and company." : "Find contact details with Apollo, review the match, and save the lead. Lookups may use Apollo credits.")}>
        <span><LeadIconButton aria-label="About contact enrichment"><CircleHelp size={19} /></LeadIconButton></span>
      </Tooltip>
      {settings && !settings.available && !settings.error && <Link className={outreach.enrichmentSetupLink} href="/admin/integrations" target="_blank" rel="noreferrer">Set up Apollo ↗</Link>}
    </div>
    {settings?.available && <LeadCheckbox checked={includePhone} disabled={busy} onChange={event => setIncludePhone(event.target.checked)} label={<>

      Include phone number <small>Additional Apollo credits may apply</small>
    </>}></LeadCheckbox>}
    {error && <Alert role="alert" severity="error">{error}</Alert>}
    {result && <div className={outreach.enrichmentResult} role="status" aria-live="polite" aria-atomic="true">
      <div className={outreach.enrichmentResultHeader}>
        <div>
          <span className={outreach.enrichmentEyebrow}>Apollo result</span>
          <Typography component="h4" variant="subtitle1">{result.matched ? result.name || "Contact found" : "No matching contact"}</Typography>
        </div>
        {result.email && <span className={outreach.enrichmentBadge}>
          {result.emailStatus === "verified" && <Check size={14} aria-hidden="true" />}
          {result.emailStatus === "verified" ? "Email verified by Apollo" : result.emailStatus === "unknown" ? "Email status not provided" : `Email: ${result.emailStatus.replaceAll("_", " ")}`}
        </span>}
      </div>
      {!result.matched ? <Typography className={outreach.enrichmentNote} component="p" variant="body2">Apollo couldn’t find this person. Check the name, company and LinkedIn profile, then try again.</Typography> : <>
        <dl className={outreach.enrichmentDetails}>
          {result.title && <div><dt>Role</dt><dd>{result.title}</dd></div>}
          {result.company && <div><dt>Company</dt><dd>{result.company}</dd></div>}
          <div><dt>Identity match</dt><dd>{{
                high: "High confidence",
                medium: "Medium confidence",
                low: "Low confidence"
              }[result.matchConfidence] || "Confidence not provided by Apollo"}</dd></div>
        </dl>
        {result.email ? <>
          <div className={outreach.enrichmentEmail}>
            <Mail size={18} aria-hidden="true" />
            <div><span className={outreach.enrichmentEyebrow}>Work email</span><strong>{result.email}</strong></div>
          </div>
          <div className={outreach.enrichmentResultFooter}>
            <Typography className={outreach.enrichmentNote} component="p" variant="body2">{contact.email === result.email ? "This email is in the form. Save the lead to keep your changes." : contact.email ? `Review the match. Applying this result replaces ${contact.email}.` : "Review the person’s details before applying this email."}</Typography>
            <LeadButton type="button" disabled={contact.email === result.email} onClick={() => onApply(result.email)} variant="outlined">{contact.email === result.email ? "Email applied" : contact.email ? "Replace email" : "Use this email"}</LeadButton>
          </div>
        </> : <Typography className={outreach.enrichmentNote} component="p" variant="body2">Contact found, but Apollo did not return an available work email.</Typography>}
        {result.phoneRequested && <ApolloPhones result={result} phone={contact.phone} onApply={onApplyPhone} />}
      </>}
    </div>}
  </section>;
}
