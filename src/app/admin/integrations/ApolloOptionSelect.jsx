"use client";

import {useEffect, useRef, useState} from "react";
import {RefreshCw} from "lucide-react";
import {FormSelect, FormButton, FormIconButton} from "../components/forms/FormFields";
import {Stack} from "@mui/material";
import ui from "./integrations.module.css";

export default function ApolloOptionSelect({kind, value, onChange, label, required = true, emptyLabel, savedLabel}) {
  const [options, setOptions] = useState([]);
  const [nextPage, setNextPage] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const controller = useRef(null);
  const lists = kind === "lists";
  const sequence = kind === "sequences";
  async function load(page = 1) {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/integrations/apollo/options?kind=${kind}&page=${page}`, {cache: "no-store", signal: abort.signal});
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load options.");
      if (abort.signal.aborted) return;
      setOptions((current) => [...new Map([...(page === 1 ? [] : current), ...data.options].map((item) => [item.id, item])).values()]);
      setNextPage(data.nextPage);
      setLoaded(true);
    } catch (failure) { if (!abort.signal.aborted) setError(failure.message || "Unable to load options."); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  useEffect(() => {
    void load();
    return () => controller.current?.abort();
    // The parent remounts this selector when the saved credentials change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const selected = options.find((item) => item.id === value);
  return <div className={ui.optionPicker}>
    <Stack direction="row" spacing={.5} sx={{alignItems: "flex-start"}}>
    <FormSelect label={label || (sequence ? "Sequence" : "Sending account")} value={value} required={required} busy={busy} error={error}
      placeholder={busy && !loaded ? "Loading from Apollo…" : sequence ? required ? "Choose a sequence" : (emptyLabel || "No fallback — list only") : lists ? "Choose a contact list" : "Choose a sending account"}
      options={[
        ...(value && !selected ? [{value, label: savedLabel || "Saved selection", description: savedLabel || value}] : []),
        ...options.map((item) => ({value: item.id, label: item.label, description: item.status, disabled: item.disabled})),
      ]}
      onChange={(next) => onChange(next, options.find((item) => item.id === next))} />
      <FormIconButton label={`Refresh ${sequence ? "sequences" : lists ? "lists" : "sending accounts"}`} disabled={busy} onClick={() => load()} sx={{mt: .5}}><RefreshCw size={17} /></FormIconButton>
    </Stack>
    {nextPage && <FormButton disabled={busy} onClick={() => load(nextPage)}>Load more sequences</FormButton>}
    {!busy && loaded && !options.length && !error && <p className={ui.hint}>{sequence ? "No sequences found. Create one in Apollo, then refresh." : lists ? "No contact lists found. Use Create list to add one." : "No sending accounts found. Connect a mailbox in Apollo, then refresh."}</p>}
    {selected?.disabled && <p className={ui.hint}>The saved selection is {selected.status.toLowerCase()}. Choose another option before enrolling contacts.</p>}
    {loaded && value && !selected && <p className={ui.hint}>The saved selection is not in the loaded options. {nextPage ? "Load more sequences to find it." : "It may no longer be accessible. Choose another option if needed."}</p>}
  </div>;
}
