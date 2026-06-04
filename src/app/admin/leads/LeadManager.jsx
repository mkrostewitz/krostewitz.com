"use client";

import {X} from "lucide-react";
import mapboxgl from "mapbox-gl";
import {useEffect, useMemo, useRef, useState} from "react";

import {useLoadingState} from "../../components/loading/LoadingProvider";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const STATUS_OPTIONS = [
  {value: "", label: "All statuses"},
  {value: "pending", label: "Pending"},
  {value: "won", label: "Won"},
  {value: "lost", label: "Lost"},
  {value: "pending_verification", label: "Pending verification"},
];

const OUTCOME_STATUSES = ["pending", "won", "lost"];

const OUTCOME_STATUS_OPTIONS = STATUS_OPTIONS.filter((option) =>
  OUTCOME_STATUSES.includes(option.value)
);

const SOURCE_OPTIONS = [
  {value: "", label: "All sources"},
  {value: "contact_form", label: "Contact form"},
  {value: "cv_download", label: "CV download"},
];

const REQUEST_TYPE_LABELS = {
  general: "General",
  headhunter: "Headhunter",
  employer: "Employer",
  potential_client: "Potential client",
  fan: "Fan",
  other: "Other",
};

const STATUS_LABELS = Object.fromEntries(
  STATUS_OPTIONS.filter((option) => option.value).map((option) => [
    option.value,
    option.label,
  ])
);

const SOURCE_LABELS = Object.fromEntries(
  SOURCE_OPTIONS.filter((option) => option.value).map((option) => [
    option.value,
    option.label,
  ])
);

function formatDateTime(value) {
  if (!value) return "Not available";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function leadTitle(lead) {
  return lead.name || lead.email || "Unknown lead";
}

function requestTypeLabel(value) {
  return REQUEST_TYPE_LABELS[value] || value || "General";
}

function sourceLabel(lead) {
  return SOURCE_LABELS[lead.source?.type] || lead.source?.label || "Lead";
}

function leadActions(lead) {
  return Array.isArray(lead?.actions) ? lead.actions : [];
}

function actionTextPreview(value) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "No actions";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

function actionsPreview(lead) {
  const latestAction = leadActions(lead)[0];
  return latestAction ? actionTextPreview(latestAction.text) : "No actions";
}

function actionsCountLabel(lead) {
  const count = leadActions(lead).length;
  return `${count} action${count === 1 ? "" : "s"}`;
}

function outcomeStatus(value) {
  return OUTCOME_STATUSES.includes(value) ? value : "pending";
}

function compactLocation(tracking = {}) {
  return (
    tracking.address ||
    [tracking.city, tracking.state, tracking.country].filter(Boolean).join(", ") ||
    "Unknown"
  );
}

function getLeadCoordinates(lead) {
  const longitude = Number(lead?.tracking?.longitude);
  const latitude = Number(lead?.tracking?.latitude);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return [longitude, latitude];
}

function getLeadLocationQuery(lead) {
  const tracking = lead?.tracking || {};

  return (
    tracking.address ||
    [tracking.city, tracking.state, tracking.country].filter(Boolean).join(", ") ||
    [tracking.state, tracking.country].filter(Boolean).join(", ") ||
    tracking.country ||
    ""
  );
}

function LeadMap({activeLeadId, leads, onSelectLead}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [resolvedCoordinates, setResolvedCoordinates] = useState({});
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const mappedLeads = useMemo(
    () =>
      leads
        .map((lead) => {
          const directCoordinates = getLeadCoordinates(lead);
          const query = getLeadLocationQuery(lead);
          const resolved = resolvedCoordinates[lead.id];
          const fallbackCoordinates =
            resolved?.query === query ? resolved.coordinates : null;

          return {
            lead,
            coordinates: directCoordinates || fallbackCoordinates,
          };
        })
        .filter((item) => item.coordinates),
    [leads, resolvedCoordinates]
  );
  const geocodeTargets = useMemo(
    () =>
      leads
        .map((lead) => ({
          lead,
          coordinates: getLeadCoordinates(lead),
          query: getLeadLocationQuery(lead),
          resolved: resolvedCoordinates[lead.id],
        }))
        .filter(
          (item) =>
            !item.coordinates &&
            item.query &&
            item.resolved?.query !== item.query
        ),
    [leads, resolvedCoordinates]
  );
  const coordinatesKey = mappedLeads
    .map((item) => `${item.lead.id}:${item.coordinates.join(",")}`)
    .join("|");

  useEffect(() => {
    if (!token || geocodeTargets.length === 0) return undefined;

    const controller = new AbortController();

    async function resolveLocations() {
      const results = await Promise.all(
        geocodeTargets.map(async ({lead, query}) => {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                query
              )}.json?access_token=${encodeURIComponent(token)}&limit=1`,
              {signal: controller.signal}
            );
            const data = await response.json().catch(() => ({}));
            const center = data.features?.[0]?.center;
            const coordinates =
              response.ok &&
              Array.isArray(center) &&
              center.length >= 2 &&
              Number.isFinite(Number(center[0])) &&
              Number.isFinite(Number(center[1]))
                ? [Number(center[0]), Number(center[1])]
                : null;

            return {leadId: lead.id, query, coordinates};
          } catch (error) {
            if (error?.name === "AbortError") return null;
            return {leadId: lead.id, query, coordinates: null};
          }
        })
      );

      if (controller.signal.aborted) return;

      setResolvedCoordinates((current) => {
        const next = {...current};

        for (const result of results) {
          if (!result) continue;
          next[result.leadId] = {
            query: result.query,
            coordinates: result.coordinates,
          };
        }

        return next;
      });
    }

    void resolveLocations();

    return () => {
      controller.abort();
    };
  }, [geocodeTargets, token]);

  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current || mappedLeads.length === 0) {
      return undefined;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      attributionControl: false,
      center: mappedLeads[0].coordinates,
      container: containerRef.current,
      pitch: 0,
      style: "mapbox://styles/mapbox/light-v11",
      zoom: mappedLeads.length === 1 ? 6 : 2,
    });

    map.addControl(
      new mapboxgl.AttributionControl({compact: true}),
      "bottom-right"
    );
    map.addControl(
      new mapboxgl.NavigationControl({showCompass: false}),
      "top-right"
    );

    mapRef.current = map;

    map.on("load", () => {
      map.resize();
    });
    map.on("error", () => {
      console.warn("Unable to render lead map.");
    });

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [mappedLeads, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = mappedLeads.map(({lead, coordinates}) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = `${styles.leadMapMarker} ${
        lead.id === activeLeadId ? styles.leadMapMarkerActive : ""
      }`;
      markerElement.title = leadTitle(lead);
      markerElement.setAttribute("aria-label", `Select ${leadTitle(lead)}`);
      markerElement.addEventListener("click", () => onSelectLead(lead.id));

      return new mapboxgl.Marker({anchor: "bottom", element: markerElement})
        .setLngLat(coordinates)
        .addTo(map);
    });

    if (mappedLeads.length === 1) {
      map.easeTo({center: mappedLeads[0].coordinates, zoom: 6, duration: 0});
    } else if (mappedLeads.length > 1) {
      const bounds = mappedLeads.reduce(
        (nextBounds, item) => nextBounds.extend(item.coordinates),
        new mapboxgl.LngLatBounds(mappedLeads[0].coordinates, mappedLeads[0].coordinates)
      );
      map.fitBounds(bounds, {duration: 0, maxZoom: 8, padding: 54});
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [activeLeadId, coordinatesKey, mappedLeads, onSelectLead]);

  useEffect(() => {
    const map = mapRef.current;
    const activeItem = mappedLeads.find((item) => item.lead.id === activeLeadId);

    if (!map || !activeItem) return;

    map.easeTo({
      center: activeItem.coordinates,
      duration: 350,
      zoom: Math.max(map.getZoom(), 5),
    });
  }, [activeLeadId, mappedLeads]);

  if (!token) {
    return (
      <div className={styles.leadMapPlaceholder}>
        Map unavailable. Configure `NEXT_PUBLIC_MAPBOX_TOKEN`.
      </div>
    );
  }

  if (mappedLeads.length === 0) {
    return (
      <div className={styles.leadMapPlaceholder}>
        {geocodeTargets.length > 0
          ? "Resolving lead locations..."
          : "No location data is available for the current leads."}
      </div>
    );
  }

  return (
    <div className={styles.leadMap} aria-label="Lead locations">
      <div className={styles.leadMapCanvas} ref={containerRef} />
    </div>
  );
}

export default function LeadManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [leads, setLeads] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [actionDraft, setActionDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("pending");
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState("");

  useLoadingState({
    isLoading,
    label: "Loading leads...",
    type: "page",
  });
  useLoadingState({
    isLoading: Boolean(savingLeadId),
    label: "Saving lead...",
    type: "action",
  });

  const activeLead = useMemo(
    () => leads.find((lead) => lead.id === activeLeadId) || null,
    [activeLeadId, leads]
  );

  const visibleLeads = useMemo(
    () =>
      statusFilter
        ? leads.filter((lead) => lead.status === statusFilter)
        : leads,
    [leads, statusFilter]
  );

  const activeLeadStatus = outcomeStatus(activeLead?.status);
  const hasLeadDraftChanges = Boolean(
    activeLead && (actionDraft.trim() || statusDraft !== activeLeadStatus)
  );

  const counts = useMemo(
    () =>
      leads.reduce(
        (acc, lead) => {
          acc.total += 1;
          acc[lead.status] = (acc[lead.status] || 0) + 1;
          return acc;
        },
        {total: 0, pending: 0, won: 0, lost: 0}
      ),
    [leads]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadLeads() {
      setIsLoading(true);

      try {
        const response = await fetch("/api/admin/leads", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load leads.");
        }

        if (!cancelled) {
          const nextLeads = data.leads || [];
          setLeads(nextLeads);
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) {
          showSnackbar({type: "error", message: error.message});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadLeads();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar]);

  useEffect(() => {
    setActiveLeadId((current) =>
      visibleLeads.some((lead) => lead.id === current)
        ? current
        : visibleLeads[0]?.id || ""
    );
  }, [visibleLeads]);

  useEffect(() => {
    setActionDraft("");
    setStatusDraft(outcomeStatus(activeLead?.status));
  }, [activeLead?.id, activeLead?.status]);

  useEffect(() => {
    if (isDetailsOpen && !activeLead) {
      setIsDetailsOpen(false);
    }
  }, [activeLead, isDetailsOpen]);

  useEffect(() => {
    if (!isDetailsOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setIsDetailsOpen(false);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isDetailsOpen]);

  function leadMatchesCurrentFilters(lead) {
    if (statusFilter && lead.status !== statusFilter) return false;
    return true;
  }

  function openLeadDetails(leadId) {
    setActiveLeadId(leadId);
    setIsDetailsOpen(true);
  }

  async function updateLead(leadId, patch, successMessage) {
    setSavingLeadId(leadId);
    closeSnackbar();

    try {
      const response = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to update lead.");
      }

      setLeads((current) =>
        current.map((lead) => (lead.id === leadId ? data.lead : lead))
      );

      if (!leadMatchesCurrentFilters(data.lead)) {
        setActiveLeadId((current) => (current === leadId ? "" : current));
        setIsDetailsOpen(false);
      } else if (data.lead.id === activeLeadId) {
        setActionDraft("");
        setStatusDraft(outcomeStatus(data.lead.status));
      }

      showSnackbar({type: "success", message: successMessage});
      return data.lead;
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
      return null;
    } finally {
      setSavingLeadId("");
    }
  }

  function saveLeadDraft(lead) {
    const patch = {};
    const actionText = actionDraft.trim();

    if (actionText) {
      patch.actionText = actionDraft;
    }

    if (
      OUTCOME_STATUSES.includes(lead.status) ||
      statusDraft !== outcomeStatus(lead.status)
    ) {
      patch.status = statusDraft;
    }

    return updateLead(lead.id, patch, "Lead updated.");
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="leads" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Leads</h1>
            <p className={styles.muted}>
              Review contact messages and verified CV download requests.
            </p>
          </div>
        </div>

        <div className={styles.leadStats} aria-label="Lead status filters">
          {[
            {value: "", label: "total", count: counts.total},
            {value: "pending", label: "pending", count: counts.pending || 0},
            {value: "won", label: "won", count: counts.won || 0},
            {value: "lost", label: "lost", count: counts.lost || 0},
          ].map((chip) => (
            <button
              key={chip.value || "total"}
              type="button"
              className={`${styles.leadStatChip} ${
                statusFilter === chip.value ? styles.leadStatChipActive : ""
              }`}
              aria-pressed={statusFilter === chip.value}
              onClick={() => setStatusFilter(chip.value)}
            >
              {chip.count} {chip.label}
            </button>
          ))}
        </div>

        <div className={styles.leadWorkspace}>
          <section className={styles.postListPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Lead map</h2>
                <p className={styles.muted}>
                  Select a marker or a lead below to inspect details.
                </p>
              </div>
            </div>

            <LeadMap
              activeLeadId={activeLead?.id || ""}
              leads={visibleLeads}
              onSelectLead={openLeadDetails}
            />

            <div className={styles.leadList} aria-label="Leads">
              <div className={styles.leadListHeader} aria-hidden="true">
                <span>Lead</span>
                <span>Source</span>
                <span>Type</span>
                <span>Status</span>
                <span>Actions</span>
                <span>Created</span>
              </div>

              {visibleLeads.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  className={`${styles.leadListRow} ${
                    activeLead?.id === lead.id ? styles.leadListRowActive : ""
                  }`}
                  onClick={() => openLeadDetails(lead.id)}
                >
                  <span className={styles.leadIdentity}>
                    <strong>{leadTitle(lead)}</strong>
                    <small>{lead.email}</small>
                  </span>
                  <span className={styles.sourceBadge}>{sourceLabel(lead)}</span>
                  <span>{requestTypeLabel(lead.requestType)}</span>
                  <span className={styles.statusBadge}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  <span
                    className={`${styles.postListCellSecondary} ${styles.leadActionPreview}`}
                  >
                    <strong>{actionsCountLabel(lead)}</strong>
                    <small>{actionsPreview(lead)}</small>
                  </span>
                  <span className={styles.postListCellSecondary}>
                    {formatDateTime(lead.createdAt)}
                  </span>
                </button>
              ))}

              {!isLoading && visibleLeads.length === 0 && (
                <p className={styles.postListEmpty}>No leads match this view.</p>
              )}
            </div>
          </section>
        </div>

        {isDetailsOpen && activeLead && (
          <div
            className={styles.leadModalBackdrop}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsDetailsOpen(false);
              }
            }}
          >
            <section
              aria-labelledby="lead-details-title"
              aria-modal="true"
              className={styles.leadModalPanel}
              role="dialog"
            >
              <div className={styles.leadModalHeader}>
                <div className={styles.titleBlock}>
                  <h2 id="lead-details-title">{leadTitle(activeLead)}</h2>
                  <p className={styles.muted}>{sourceLabel(activeLead)}</p>
                </div>
                <div className={styles.leadModalHeaderActions}>
                  <span className={styles.statusBadge}>
                    {STATUS_LABELS[activeLead.status] || activeLead.status}
                  </span>
                  <button
                    type="button"
                    className={styles.iconButton}
                    aria-label="Close lead details"
                    title="Close"
                    onClick={() => setIsDetailsOpen(false)}
                  >
                    <X aria-hidden="true" size={18} strokeWidth={2.3} />
                  </button>
                </div>
              </div>

              <div className={styles.leadModalBody}>
                <div className={styles.leadDetailGrid}>
                  <div>
                    <span>Email</span>
                    <strong>{activeLead.email}</strong>
                  </div>
                  <div>
                    <span>Phone</span>
                    <strong>{activeLead.phone || "Not provided"}</strong>
                  </div>
                  <div>
                    <span>Request type</span>
                    <strong>{requestTypeLabel(activeLead.requestType)}</strong>
                  </div>
                  <div>
                    <span>Verified</span>
                    <strong>{formatDateTime(activeLead.verifiedAt)}</strong>
                  </div>
                  <div>
                    <span>Downloads</span>
                    <strong>{activeLead.downloadCount || 0}</strong>
                  </div>
                  <div>
                    <span>Last download</span>
                    <strong>{formatDateTime(activeLead.downloadedAt)}</strong>
                  </div>
                </div>

                {activeLead.message && (
                  <div className={styles.leadMessage}>
                    <span>Message</span>
                    <p>{activeLead.message}</p>
                  </div>
                )}

                <div className={styles.leadTrackingGrid}>
                  <div>
                    <span>IP</span>
                    <strong>{activeLead.tracking?.ip || "Unknown"}</strong>
                  </div>
                  <div>
                    <span>Country</span>
                    <strong>{activeLead.tracking?.country || "Unknown"}</strong>
                  </div>
                  <div>
                    <span>State</span>
                    <strong>{activeLead.tracking?.state || "Unknown"}</strong>
                  </div>
                  <div>
                    <span>Address</span>
                    <strong>{compactLocation(activeLead.tracking)}</strong>
                  </div>
                  <div className={styles.leadWideDetail}>
                    <span>Page</span>
                    <strong>
                      {activeLead.tracking?.pageUrl ||
                        activeLead.tracking?.referrer ||
                        "Unknown"}
                    </strong>
                  </div>
                  <div className={styles.leadWideDetail}>
                    <span>User agent</span>
                    <strong>{activeLead.tracking?.userAgent || "Unknown"}</strong>
                  </div>
                </div>

                <div className={styles.leadManageGrid}>
                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>Lead status</span>
                    <select
                      value={statusDraft}
                      disabled={savingLeadId === activeLead.id}
                      onChange={(event) => setStatusDraft(event.target.value)}
                    >
                      {OUTCOME_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className={styles.field}>
                    <span className={styles.fieldLabel}>New action</span>
                    <textarea
                      value={actionDraft}
                      onChange={(event) => setActionDraft(event.target.value)}
                      placeholder="Log a follow-up, call, email, or next step."
                    />
                  </label>
                </div>

                <div className={styles.leadModalActions}>
                  <button
                    type="button"
                    className={styles.button}
                    disabled={savingLeadId === activeLead.id || !hasLeadDraftChanges}
                    onClick={() => void saveLeadDraft(activeLead)}
                  >
                    {savingLeadId === activeLead.id ? "Saving..." : "Save changes"}
                  </button>
                </div>

                <div className={styles.leadActionSection}>
                  <div className={styles.leadActionHeader}>
                    <h3>Actions</h3>
                    <span>{actionsCountLabel(activeLead)}</span>
                  </div>

                  {leadActions(activeLead).length > 0 ? (
                    <div className={styles.leadActionList}>
                      {leadActions(activeLead).map((action) => (
                        <article key={action.id} className={styles.leadActionItem}>
                          <div className={styles.leadActionMeta}>
                            <strong>
                              {action.legacy
                                ? "Legacy note"
                                : action.createdBy || "Admin action"}
                            </strong>
                            <span>{formatDateTime(action.createdAt)}</span>
                          </div>
                          <p>{action.text}</p>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.leadActionEmpty}>
                      No actions logged yet.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
