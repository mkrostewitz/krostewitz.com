"use client";

import {useEffect, useRef, useState} from "react";
import {normalizeResearch, researchIdentity, researchFactSections, researchCategories} from "../../lib/contactResearch.mjs";
import LeadTagsAutocomplete from "./LeadTagsAutocomplete";
import {normalizeCategories} from "../../lib/contactCategories.mjs";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";

function CitedText({research, start = 0, end = research.text.length}) {
  const nodes = [];
  let cursor = start;
  research.citations.forEach((citation, index) => {
    if (citation.start < cursor || citation.end > end) return;
    nodes.push(research.text.slice(cursor, citation.start));
    nodes.push(<a key={index} href={citation.url} target="_blank" rel="noopener noreferrer" title={citation.title} aria-label={`Source ${index + 1}: ${citation.title}`}>[{index + 1}]</a>);
    cursor = citation.end;
  });
  nodes.push(research.text.slice(cursor, end));
  return <span className={outreach.researchText}>{nodes}</span>;
}

export default function ContactResearch({contact, value, onChange, onCategoriesChange}) {
  const [catalog, setCatalog] = useState({industries: [], products: []});
  const [catalogError, setCatalogError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/leads/research", {signal: abort.signal}).then(async (response) => {
      if (!response.ok) throw new Error("Saved categories could not be loaded. You can still add tags.");
      const data = await response.json();
      setCatalog({industries: normalizeCategories(data.categories.industries), products: normalizeCategories(data.categories.products)});
    }).catch((error) => {if (error.name !== "AbortError") setCatalogError(error.message);});
    return () => abort.abort();
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef(null);
  useEffect(() => () => controller.current?.abort(), []);
  const identity = researchIdentity(contact);
  const identityKey = JSON.stringify(identity);
  const currentIdentity = useRef(identityKey);
  useEffect(() => { currentIdentity.current = identityKey; }, [identityKey]);
  const research = normalizeResearch(value);
  const sections = research ? researchFactSections(research.text) : null;
  const stale = research && JSON.stringify(research.identity) !== identityKey;
  const ready = (identity.firstName || identity.lastName) && (identity.company || identity.linkedinUrl || identity.website || identity.detailsSource);

  async function run() {
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/admin/leads/research", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({contact: identity}), signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to research this contact.");
      if (currentIdentity.current !== identityKey) throw new Error("Contact details changed during research. Please research again.");
      const result = normalizeResearch(data.research);
      if (!result) throw new Error("Research returned no readable result. Please try again.");
      onChange(result);
      const suggested = researchCategories(result);
      onCategoriesChange({industries: normalizeCategories([...(contact.industries || []), ...suggested.industries]), products: normalizeCategories([...(contact.products || []), ...suggested.products])});
    } catch (failure) {
      if (failure.name !== "AbortError") setError(failure.message || "Unable to research this contact.");
    } finally { setBusy(false); }
  }

  function categories() {
    return <div className={outreach.companyCategories}>
      <h5>Company categories</h5>
      <p className={styles.muted}>Review suggested tags or choose saved categories. New tags become reusable when you save the lead.</p>
      {catalogError && <p role="status" className={styles.muted}>{catalogError}</p>}
      {["industries", "products"].map((field) => {
        const fact = sections?.find((section) => section.title === "Company")?.facts.find((item) => item.label.toLowerCase() === field);
        return <div key={field}>
          <LeadTagsAutocomplete label={field === "industries" ? "Industries" : "Products"} value={normalizeCategories(contact[field])} options={catalog[field]} allowCreate disabled={busy}
            onChange={(tags) => onCategoriesChange({[field]: normalizeCategories(tags)})} />
          {fact && <div className={outreach.categorySources}>{research.citations.map((citation, index) => citation.start >= fact.start && citation.end <= fact.end
            ? <a key={index} href={citation.url} title={citation.title} aria-label={`Source ${index + 1}: ${citation.title}`} target="_blank" rel="noopener noreferrer">[{index + 1}]</a> : null)}</div>}
        </div>;
      })}
    </div>;
  }

  return <section className={outreach.formSection} aria-label="AI contact research" aria-busy={busy}>
    <div className={outreach.sectionHeader}>
      <h3>Company &amp; person facts</h3>
      <button type="button" className={styles.secondaryButton} disabled={busy || !ready} onClick={run}>{busy ? "Researching…" : research ? "Refresh AI research" : "Research with AI"}</button>
    </div>
    <p className={styles.muted}>A short fact list: industries, revenue, products, current position, experience, and press releases. Sources are linked beside each finding.</p>
    {!ready && <p className={styles.muted}>Add a name and a company or profile link to identify the right person.</p>}
    {busy && <p role="status" className={styles.muted}>Searching public sources… This may take a minute.</p>}
    {error && <p role="alert" className={outreach.fieldError}>{error}</p>}
    {!research && categories()}
    {research && <>
      {stale && <p role="status" className={outreach.fieldError}>Contact details have changed since this research. Refresh it to check the match.</p>}
      {sections ? <div className={outreach.researchFacts}>
        {sections.map((section) => <div key={section.title} className={outreach.researchGroup}>
          <h4>{section.title}</h4>
          <dl>{section.facts.filter((fact) => !["industries", "products"].includes(fact.label.toLowerCase())).map((fact) => <div key={fact.start}>
            <dt>{fact.label}</dt>
            <dd><CitedText research={research} start={fact.start} end={fact.end} /></dd>
          </div>)}</dl>
          {section.title === "Company" && categories()}
        </div>)}
      </div> : <>
        <p className={styles.muted}>Refresh AI research to get the new Company / Person fact list.</p>
        <CitedText research={research} />
        {categories()}
      </>}
      {!research.citations.length && <p className={styles.muted}>No source citations were returned. Treat this result as unverified.</p>}
      <p className={styles.muted}>AI research{research.researchedAt ? ` · ${new Date(research.researchedAt).toLocaleDateString()}` : ""}. Check the identity and sources before using it. Saved with the lead when you save changes.</p>
      <div><button type="button" className={styles.secondaryButton} disabled={busy} onClick={() => onChange(null)}>Remove research</button></div>
    </>}
  </section>;
}
