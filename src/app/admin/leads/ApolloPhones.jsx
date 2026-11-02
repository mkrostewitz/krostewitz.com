"use client";

import { Alert, Typography } from "@mui/material";
import { LeadButton } from "./LeadUi";
import { useEffect, useState } from "react";
import ui from "./outreach.module.css";
export default function ApolloPhones({
  result,
  phone,
  onApply
}) {
  const [state, setState] = useState({
    pending: Boolean(result.phoneRequestId),
    phones: result.phones || []
  });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!result.phoneRequestId) return;
    const abort = new AbortController();
    let timer;
    const deadline = Date.now() + 5 * 60000;
    async function check() {
      try {
        const params = new URLSearchParams({
          requestId: result.phoneRequestId,
          personId: result.phonePersonId
        });
        const response = await fetch(`/api/admin/leads/enrich/phone?${params}`, {
          cache: "no-store",
          signal: abort.signal
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to check phone enrichment.");
        if (abort.signal.aborted) return;
        if (data.pending) {
          if (Date.now() >= deadline) {
            setState(current => ({
              ...current,
              pending: false,
              error: "Apollo is still processing. Check again to retrieve this lookup without starting a new one."
            }));
            return;
          }
          setState(current => ({
            ...current,
            pending: true,
            error: ""
          }));
          timer = setTimeout(check, data.retryAfter * 1000);
        } else setState({
          pending: false,
          phones: data.phones
        });
      } catch (error) {
        if (!abort.signal.aborted) setState(current => ({
          ...current,
          pending: false,
          error: error.message
        }));
      }
    }
    timer = setTimeout(check, attempt ? 0 : 10000);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [result.phoneRequestId, result.phonePersonId, attempt]);
  return <div className={ui.enrichmentPhones}>
    <span className={ui.enrichmentEyebrow}>Phone numbers</span>
    {state.pending && <Alert role="status" severity="info">Apollo is looking up phone numbers. This can take a few minutes.</Alert>}
    {state.phones.map(item => <div className={ui.enrichmentPhoneRow} key={item.number}>
      <div><strong>{item.number}</strong><Typography className={ui.enrichmentNote} component="p" variant="body2">{item.type} · Status: {item.status} · Do-not-call status: {item.doNotCall}</Typography></div>
      <LeadButton type="button" disabled={phone === item.number} onClick={() => onApply(item.number)} variant="outlined">
        {phone === item.number ? "Phone applied" : phone ? "Replace phone" : "Use this phone"}
      </LeadButton>
    </div>)}
    {!state.pending && !state.error && !state.phones.length && <Typography className={ui.enrichmentNote} component="p" variant="body2">{result.phoneRequestId ? "Apollo did not find an available phone number." : "Apollo returned no phone number or lookup reference. No further result is available to check."}</Typography>}
    {state.error && <><Alert role="alert" severity="error">{state.error}</Alert><LeadButton type="button" onClick={() => {
        setState(current => ({
          ...current,
          pending: true,
          error: ""
        }));
        setAttempt(value => value + 1);
      }} variant="outlined">Check again</LeadButton></>}
    {state.phones.length > 0 && <Typography className={ui.enrichmentNote} component="p" variant="body2">Review the number before applying it, then save the lead.</Typography>}
  </div>;
}
