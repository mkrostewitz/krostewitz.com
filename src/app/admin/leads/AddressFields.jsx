"use client";

import {useEffect, useId, useRef, useState} from "react";
import {ADDRESS_FIELDS, addressFromMapbox, formatAddress, normalizeAddress} from "../../lib/leadAddress.mjs";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";

export default function AddressFields({address, legacyLocation, onChange}) {
  const [query, setQuery] = useState(legacyLocation || formatAddress(address));
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const request = useRef(null);
  const debounce = useRef(null);
  const list = useRef(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const expanded = open && results.length > 0;
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  useEffect(() => () => {
    clearTimeout(debounce.current);
    request.current?.abort();
  }, []);
  useEffect(() => {
    if (expanded && activeIndex >= 0) list.current?.children[activeIndex]?.scrollIntoView({block: "nearest"});
  }, [activeIndex, expanded]);

  function invalidateSearch() {
    clearTimeout(debounce.current);
    setActiveIndex(-1);
    request.current?.abort();
    request.current = null;
    setSearching(false);
    setResults([]);
    setMessage("");
  }

  async function search(value) {
    if (value.trim().length < 3 || !token) return;
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    try {
      // Permanent geocoding allows selected address fields and coordinates to be saved.
      const params = new URLSearchParams({q: value.trim(), access_token: token, permanent: "true", autocomplete: "true", types: "address,street,postcode,place", limit: "5"});
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {signal: controller.signal});
      if (!response.ok) throw new Error("Address search is unavailable. Try again or enter the address below.");
      const data = await response.json();
      if (request.current !== controller) return;
      const next = (data.features || []).flatMap((feature) => {
        try {
          const value = addressFromMapbox(feature);
          return formatAddress(value) ? [{id: feature.id, label: feature.properties?.full_address || formatAddress(value), value}] : [];
        } catch { return []; }
      });
      setResults(next);
      setMessage(next.length ? `${next.length} address suggestions. Use the arrow keys and Enter to select.` : "No addresses found. Try a more specific search or enter the address below.");
    } catch (error) {
      if (request.current === controller && error.name !== "AbortError") setMessage("Address search is unavailable. Try again or enter the address below.");
    } finally {
      if (request.current === controller) setSearching(false);
    }
  }

  function changeQuery(value) {
    invalidateSearch();
    setQuery(value);
    setOpen(true);
    if (value.trim().length >= 3 && token) {
      debounce.current = setTimeout(() => void search(value), 350);
    }
  }

  function selectResult(result) {
    invalidateSearch();
    onChange(result.value);
    setQuery(result.label);
    setOpen(false);
    setMessage("Address selected. Review the fields before saving the lead.");
  }

  function handleKeyDown(event) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape" && (open || searching)) {
      event.preventDefault();
      event.stopPropagation();
      invalidateSearch();
      setOpen(false);
    } else if (["ArrowDown", "ArrowUp"].includes(event.key) && results.length) {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => event.key === "ArrowDown"
        ? (current + 1) % results.length
        : (current <= 0 ? results.length : current) - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (expanded) selectResult(results[activeIndex < 0 ? 0 : activeIndex]);
    }
  }

  return <section aria-label="Address (optional)" className={outreach.addressBlock}>
    <h3>Address <small className={styles.muted}>(optional)</small></h3>
    <p className={styles.muted}>Search to fill the address, or enter any details you have. All fields are optional.</p>
    {legacyLocation && <p className={styles.muted}>Previous location: {legacyLocation}. Search or enter its address details below.</p>}
    <div className={outreach.addressAutocomplete} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label className={styles.field}>Search address
        <input type="text" role="combobox" aria-autocomplete="list" aria-expanded={expanded}
          aria-controls={listId} aria-activedescendant={expanded && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={`${listId}-status`} maxLength={250} value={query} autoComplete="off"
          placeholder="Start typing a street, city, or postal code"
          onFocus={() => setOpen(true)} onChange={(event) => changeQuery(event.target.value)} onKeyDown={handleKeyDown} />
      </label>
      {expanded && <ul ref={list} id={listId} role="listbox" className={outreach.addressResults} aria-label="Address suggestions">
        {results.map((result, index) => <li key={result.id || index} id={`${listId}-${index}`} role="option"
          aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)}
          onPointerDown={(event) => event.preventDefault()} onClick={() => selectResult(result)}>
          {result.label}
        </li>)}
      </ul>}
    </div>
    {!token && <p className={styles.muted}>Address search is not configured. You can still enter and save an address manually.</p>}
    <p id={`${listId}-status`} role="status" className={styles.muted}>{searching ? "Searching addresses…" : message || "Type at least three characters to see suggestions."}</p>
    <div className={styles.buttonRow}>
      <button type="button" className={styles.secondaryButton} onClick={() => {invalidateSearch(); setQuery(""); setOpen(false); onChange(normalizeAddress());}}>Clear address</button>
    </div>
    <div className={outreach.grid}>
      {Object.entries(ADDRESS_FIELDS).map(([key, label]) => <label className={styles.field} key={key}>{label}
        <input value={address[key]} maxLength={200} onChange={(event) => {
          invalidateSearch();
          onChange({...address, [key]: event.target.value, latitude: null, longitude: null, ...(key === "country" ? {countryCode: ""} : {})});
        }} />
      </label>)}
    </div>
  </section>;
}
