"use client";

import { Alert } from "@mui/material";
import {useLeadRequirements} from "./LeadRequirements";
import { useEffect, useState } from "react";
import LeadTagsAutocomplete from "./LeadTagsAutocomplete";
import { normalizeCategories } from "../../lib/contactCategories.mjs";
export default function CompanyFields({
  contact,
  onChange,
  disabled
}) {
  const {requiredFields} = useLeadRequirements();
  const [catalog, setCatalog] = useState({
    products: [],
    applications: []
  });
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch("/api/admin/leads/research", {
      cache: "no-store",
      signal: abort.signal
    }).then(async response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(({
      categories
    }) => setCatalog({
      products: normalizeCategories(categories.products),
      applications: normalizeCategories([...(categories.applications || []), ...(categories.industries || [])])
    })).catch(failure => {
      if (failure.name !== "AbortError") setError(true);
    });
    return () => abort.abort();
  }, []);
  return <>
    {["products", "applications"].map(key => <LeadTagsAutocomplete required={requiredFields.includes(key)} key={key} label={key === "products" ? "Products" : "Industry & applications"} value={normalizeCategories(contact[key])} options={catalog[key]} allowCreate disabled={disabled} onChange={values => onChange(key, values)} help={`Select or enter ${key === "products" ? "products" : "industries and applications"}. Saved values sync to Apollo’s Company ${key === "products" ? "Products" : "Applications"} field for sequence personalization.`} />)}
    {error && <Alert role="status" severity="info">Saved suggestions could not be loaded. You can still enter products, industries and applications.</Alert>}
  </>;
}
