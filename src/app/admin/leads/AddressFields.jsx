"use client";

import { useEffect, useRef, useState } from "react";
import { Autocomplete, Alert, Box, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { ADDRESS_FIELDS, addressFromMapbox, formatAddress, normalizeAddress } from "../../lib/leadAddress.mjs";
import { LeadButton, LeadField, useLeadDisabled } from "./LeadUi";
export default function AddressFields({
  address,
  legacyLocation,
  onChange
}) {
  const disabled = useLeadDisabled();
  const [query, setQuery] = useState(legacyLocation || formatAddress(address));
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const request = useRef(null);
  const debounce = useRef(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  useEffect(() => () => {
    clearTimeout(debounce.current);
    request.current?.abort();
  }, []);
  function invalidateSearch() {
    clearTimeout(debounce.current);
    request.current?.abort();
    request.current = null;
    setSearching(false);
    setResults([]);
    setMessage("");
  }
  async function search(value) {
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    try {
      const params = new URLSearchParams({
        q: value.trim(),
        access_token: token,
        permanent: "true",
        autocomplete: "true",
        types: "address,street,postcode,place",
        limit: "5"
      });
      const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {
        signal: controller.signal
      });
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (request.current !== controller) return;
      const next = (data.features || []).flatMap(feature => {
        try {
          const value = addressFromMapbox(feature);
          return formatAddress(value) ? [{
            id: feature.id,
            label: feature.properties?.full_address || formatAddress(value),
            value
          }] : [];
        } catch {
          return [];
        }
      });
      setResults(next);
      if (!next.length) setMessage("No addresses found. Try a more specific search or enter the address below.");
    } catch (error) {
      if (request.current === controller && error.name !== "AbortError") setMessage("Address search is unavailable. You can enter the address manually.");
    } finally {
      if (request.current === controller) setSearching(false);
    }
  }
  function changeQuery(value) {
    invalidateSearch();
    setQuery(value);
    if (value.trim().length >= 3 && token) debounce.current = setTimeout(() => void search(value), 350);
  }
  return <Stack spacing={2}>
    <Typography variant="subtitle1">Address (optional)</Typography>
    {legacyLocation && <Typography variant="body2" color="text.secondary">Previous location: {legacyLocation}</Typography>}
    <Autocomplete freeSolo disabled={disabled} options={results} filterOptions={options => options} loading={searching} value={null} inputValue={query} getOptionLabel={item => typeof item === "string" ? item : item.label} isOptionEqualToValue={(a, b) => a.id === b.id} onInputChange={(_, input, reason) => {
      if (reason === "input" || reason === "clear") changeQuery(input);
    }} onChange={(_, result) => {
      if (!result || typeof result === "string") return;
      invalidateSearch();
      onChange(result.value);
      setQuery(result.label);
      setMessage("Address selected. Review the fields before saving.");
    }} renderInput={params => <TextField {...params} label="Search address" placeholder="Street, city, or postal code" helperText="Type at least three characters to search, or enter details below." slotProps={{
      ...params.slotProps,
      htmlInput: {
        ...params.slotProps.htmlInput,
        maxLength: 250
      },
      input: {
        ...params.slotProps.input,
        endAdornment: <>{searching && <CircularProgress size={18} />}{params.slotProps.input.endAdornment}</>
      }
    }} />} />
    {!token && <Alert severity="info">Address search is not configured. You can enter the address manually.</Alert>}
    {message && <Alert severity="info">{message}</Alert>}
    <div><LeadButton onClick={() => {
        invalidateSearch();
        setQuery("");
        onChange(normalizeAddress());
      }}>Clear address</LeadButton></div>
    <Box sx={{
      display: "grid",
      gridTemplateColumns: {
        xs: "1fr",
        sm: "1fr 1fr"
      },
      gap: 2
    }}>
      {Object.entries(ADDRESS_FIELDS).map(([key, label]) => <LeadField key={key} label={label} value={address[key]} maxLength={200} onChange={event => {
        invalidateSearch();
        onChange({
          ...address,
          [key]: event.target.value,
          latitude: null,
          longitude: null,
          ...(key === "country" ? {
            countryCode: ""
          } : {})
        });
      }} />)}
    </Box>
  </Stack>;
}
