"use client";

import {useState} from "react";
import LeadMap from "../leads/LeadMap";
import {subscriberLocationLabel} from "../../lib/subscriberLocation.mjs";
import styles from "./subscribers.module.css";

export default function SubscriberMap({subscribers, truncated}) {
  const [selectedId, setSelectedId] = useState(null);
  const selected = subscribers.find((subscriber) => subscriber.id === selectedId);
  return <section className={styles.mapPanel} aria-labelledby="subscriber-map-title">
    <h2 id="subscriber-map-title">Subscriber locations</h2>
    <p>Approximate locations from signup or confirmation IP addresses. {subscribers.length} mapped subscribers matching your filters, across all pages.
      {truncated && " Showing the newest 2,000 mapped subscribers; narrow your filters to see others."}</p>
    <LeadMap leads={subscribers} activeLeadId={selectedId} onSelectLead={setSelectedId}
      geocode={false} mapLabel="Subscriber locations"
      emptyMessage="No locations available for these subscribers yet. Locations are collected at signup or confirmation when a public IP is available. Older records and localhost requests may have no location." />
    <p role="status">{selected
      ? `${selected.email} · ${subscriberLocationLabel(selected.tracking)} · ${selected.status}`
      : "Select a marker to see the subscriber."}</p>
  </section>;
}
