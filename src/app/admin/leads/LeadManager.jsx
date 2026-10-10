"use client";

import {LocateFixed, X} from "lucide-react";
import {useEffect, useMemo, useState} from "react";

import {useLoadingState} from "../../components/loading/LoadingProvider";
import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";
import OutreachForm from "./OutreachForm";
import LeadMap from "./LeadMap";
import DeleteLeadModal from "./DeleteLeadModal";
import CreateLeadModal from "./CreateLeadModal";
import outreach from "./outreach.module.css";
import {ACTIVITY_TYPES, CHANNELS, followUpState, localDay, matchesLeadFilters} from "../../lib/leadOutreach.mjs";

const STATUS_OPTIONS = [
  {value: "", label: "All statuses"},
  {value: "pending", label: "Pending"},
  {value: "won", label: "Won"},
  {value: "lost", label: "Lost"},
  {value: "pending_verification", label: "Pending verification"},
];

const SOURCE_OPTIONS = [
  {value: "", label: "All sources"},
  {value: "contact_form", label: "Contact form"},
  {value: "cv_download", label: "CV download"},
  {value: "manual", label: "Personal outreach"},
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
  return latestAction ? `${ACTIVITY_TYPES[latestAction.type] || "Note"}: ${actionTextPreview(latestAction.text)}` : "No activities";
}

function compactLocation(tracking = {}) {
  return (
    tracking.address ||
    [tracking.city, tracking.state, tracking.country].filter(Boolean).join(", ") ||
    "Unknown"
  );
}

export default function LeadManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [leads, setLeads] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState("");
  const [statusFilter, setStatusFilter] = useState("pending");
  const [search, setSearch] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [footerTarget, setFooterTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isMapOpen, setIsMapOpen] = useState(false);
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDay()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
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
  useLoadingState({
    isLoading: isGeolocating,
    label: "Geolocating leads...",
    type: "action",
  });

  const activeLead = useMemo(
    () => leads.find((lead) => lead.id === activeLeadId) || null,
    [activeLeadId, leads]
  );

  const visibleLeads = useMemo(() => {
    return leads.filter((lead) => matchesLeadFilters(lead, {
      status: statusFilter, source: sourceFilter, search, followUp: followUpFilter, today,
    })
    ).sort((a, b) => {
      const aDate = followUpState(a, today) === "closed" ? "9999" : a.followUpOn || "9999";
      const bDate = followUpState(b, today) === "closed" ? "9999" : b.followUpOn || "9999";
      return aDate.localeCompare(bDate) || (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [leads, statusFilter, sourceFilter, search, followUpFilter, today]);

  const overdueCount = leads.filter((lead) => followUpState(lead, today) === "overdue").length;
  const todayCount = leads.filter((lead) => followUpState(lead, today) === "today").length;
  const dueCount = overdueCount + todayCount;

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
        const nextLeads = [];
        // Read every page so older overdue leads cannot disappear behind a limit.
        for (let offset = 0; !cancelled; offset += 300) {
          const response = await fetch(`/api/admin/leads?limit=300&offset=${offset}`, {cache: "no-store"});
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Unable to load leads.");
          const page = data.leads || [];
          nextLeads.push(...page);
          if (page.length < 300) break;
        }
        if (!cancelled) {
          setLeads([...new Map(nextLeads.map((lead) => [lead.id, lead])).values()]);
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
    if (isDetailsOpen && !activeLead) {
      setIsDetailsOpen(false);
    }
  }, [activeLead, isDetailsOpen]);

  useEffect(() => {
    if (!isDetailsOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector("dialog[open]")) {
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
    return matchesLeadFilters(lead, {status: statusFilter, source: sourceFilter, search, followUp: followUpFilter, today});
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

  async function geolocateStoredLeadIps() {
    setIsGeolocating(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/leads/geolocate", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({limit: 100}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to geolocate stored lead IPs.");
      }

      const updatedLeads = Array.isArray(data.leads) ? data.leads : [];
      const updatedById = new Map(updatedLeads.map((lead) => [lead.id, lead]));

      if (updatedById.size > 0) {
        setLeads((current) =>
          current.map((lead) => updatedById.get(lead.id) || lead)
        );
      }

      const summary = data.summary || {};
      const updated = Number(summary.updated) || 0;
      const lookedUp = Number(summary.lookedUp) || 0;
      const failed = Number(summary.failed) || 0;
      const checked = Number(summary.checked) || 0;
      const message =
        updated > 0
          ? `Geolocated ${updated} lead${updated === 1 ? "" : "s"} from ${lookedUp} stored IP lookup${lookedUp === 1 ? "" : "s"}.`
          : checked > 0
            ? `No lead locations changed after ${lookedUp} stored IP lookup${lookedUp === 1 ? "" : "s"}.`
            : "No stored lead IPs need geolocation.";

      showSnackbar({
        type: failed > 0 && updated === 0 ? "error" : updated > 0 ? "success" : "info",
        message:
          failed > 0
            ? `${message} ${failed} lookup${failed === 1 ? "" : "s"} failed.`
            : message,
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsGeolocating(false);
    }
  }

  async function createLead(patch) {
    setSavingLeadId("new");
    try {
      const response = await fetch("/api/admin/leads", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(patch),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create lead.");
      setLeads((current) => [data.lead, ...current]);
      setStatusFilter("pending"); setSourceFilter(""); setSearch(""); setFollowUpFilter("");
      setIsCreating(false);
      openLeadDetails(data.lead.id);
      showSnackbar({type: "success", message: "Lead created."});
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
      return {error: error.message};
    } finally {
      setSavingLeadId("");
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="leads" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Leads</h1>
            <p className={styles.muted}>
              Track personal outreach, contact requests, and the next follow-up.
            </p>
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button className={styles.button} type="button" disabled={isCreating} onClick={() => setIsCreating(true)}>Add new lead</button>
          <button className={styles.secondaryButton} type="button" aria-pressed={followUpFilter === "due"} onClick={() => {setFollowUpFilter("due"); setStatusFilter(""); setSourceFilter(""); setSearch("");}}>{dueCount} follow-ups due</button>
        </div>
        {isCreating && <CreateLeadModal saving={savingLeadId === "new"}
          onSave={createLead} onClose={() => setIsCreating(false)} />}
        <div className={outreach.filters}>
          <label className={styles.field}>Search contacts<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, company, email, phone…" /></label>
          <label className={styles.field}>Follow-up<select aria-label="Follow-up" value={followUpFilter} onChange={(event) => setFollowUpFilter(event.target.value)}>
            <option value="">All follow-ups</option><option value="due">Due today & overdue</option><option value="overdue">Overdue</option><option value="today">Today</option><option value="upcoming">Upcoming</option><option value="unscheduled">No follow-up scheduled</option>
          </select></label>
          <label className={styles.field}>Source<select aria-label="Source" value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>{SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
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
                statusFilter === chip.value && !followUpFilter ? styles.leadStatChipActive : ""
              }`}
              aria-pressed={statusFilter === chip.value && !followUpFilter}
              onClick={() => {setStatusFilter(chip.value); setFollowUpFilter("");}}
            >
              {chip.count} {chip.label}
            </button>
          ))}
          {[
            {value: "overdue", label: "Overdue", count: overdueCount},
            {value: "today", label: "Due today", count: todayCount},
          ].map((chip) => <button
            key={chip.value} type="button"
            className={`${outreach.followUpChip} ${outreach[chip.value]} ${outreach.followUpFilter}`}
            aria-pressed={followUpFilter === chip.value}
            onClick={() => {
              setFollowUpFilter(followUpFilter === chip.value ? "" : chip.value);
              setStatusFilter(""); setSourceFilter(""); setSearch("");
            }}
          >{chip.count} {chip.label}</button>)}
        </div>

        <div className={styles.leadWorkspace}>
          <section className={styles.postListPanel}>
            <details className={outreach.mapToggle} onToggle={(event) => setIsMapOpen(event.currentTarget.open)}>
              <summary>Lead locations</summary>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Lead map</h2>
                <p className={styles.muted}>
                  Select a marker or a lead below to inspect details.
                </p>
              </div>
              <div className={styles.buttonRow}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.iconTextButton}`}
                  disabled={isGeolocating || isLoading}
                  title="Geolocate old leads from stored IP addresses"
                  onClick={() => void geolocateStoredLeadIps()}
                >
                  <LocateFixed aria-hidden="true" size={17} strokeWidth={2.2} />
                  {isGeolocating ? "Geolocating..." : "Geolocate stored IPs"}
                </button>
              </div>
            </div>

            {isMapOpen && <LeadMap
              activeLeadId={activeLead?.id || ""}
              leads={visibleLeads}
              onSelectLead={openLeadDetails}
            />}

            </details>
            <p className={styles.muted}>{visibleLeads.length} contact{visibleLeads.length === 1 ? "" : "s"} · earliest follow-up first</p>
            <div className={styles.leadList} aria-label="Leads">
              <div className={styles.leadListHeader} aria-hidden="true">
                <span>Lead</span>
                <span>Source</span>
                <span>Channel</span>
                <span>Status</span>
                <span>Latest activity</span>
                <span>Next follow-up</span>
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
                    <small>{[lead.company, lead.role].filter(Boolean).join(" · ") || lead.email}</small>
                  </span>
                  <span className={styles.sourceBadge}>{sourceLabel(lead)}</span>
                  <span>{CHANNELS[lead.preferredChannel] || "LinkedIn"}</span>
                  <span className={styles.statusBadge}>
                    {STATUS_LABELS[lead.status] || lead.status}
                  </span>
                  <span
                    className={`${styles.postListCellSecondary} ${styles.leadActionPreview}`}
                  >
                    <strong>{leadActions(lead)[0]?.occurredOn || (leadActions(lead)[0]?.createdAt ? formatDateTime(leadActions(lead)[0].createdAt) : "No activity yet")}</strong>
                    <small>{actionsPreview(lead)}</small>
                  </span>
                  <span className={`${styles.postListCellSecondary} ${outreach.followUpCell}`}>
                    <strong>{lead.followUpOn || "Not scheduled"}</strong>
                    {["overdue", "today"].includes(followUpState(lead, today))
                      ? <span className={`${outreach.followUpChip} ${outreach[followUpState(lead, today)]}`}>
                          {followUpState(lead, today) === "overdue" ? "Overdue" : "Due today"}
                        </span>
                      : lead.followUpOn && <small>{followUpState(lead, today) === "closed" ? "Closed" : "Upcoming"}</small>}
                    {lead.followUpTask && <small> — {lead.followUpTask}</small>}
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
                  <p className={styles.muted}>{[activeLead.company, activeLead.role, sourceLabel(activeLead)].filter(Boolean).join(" · ")}</p>
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
                {activeLead.source?.type !== "manual" && <details>
                  <summary>Inbound lead details</summary>
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

                </details>}

                <OutreachForm
                  key={`${activeLead.id}:${activeLead.updatedAt}`}
                  lead={activeLead}
                  footerTarget={footerTarget}
                  onCancel={() => setIsDetailsOpen(false)}
                  onDelete={() => setDeleteTarget(activeLead)}
                  saving={savingLeadId === activeLead.id}
                  onSave={(patch) => updateLead(activeLead.id, patch, "Lead updated.")}
                >

                <div className={styles.leadActionSection}>
                  {leadActions(activeLead).length > 0 ? (
                    <div className={styles.leadActionList}>
                      {leadActions(activeLead).map((action) => (
                        <article key={action.id} className={styles.leadActionItem}>
                          <div className={styles.leadActionMeta}>
                            <strong>
                              {action.legacy
                                ? "Legacy note"
                                : `${ACTIVITY_TYPES[action.type] || "Note"} · ${CHANNELS[action.channel] || "Other"}`}
                            </strong>
                            <span>{action.occurredOn || formatDateTime(action.createdAt)}</span>
                          </div>
                          <p>{action.text}</p>
                          <small className={styles.muted}>Logged {formatDateTime(action.createdAt)}{action.createdBy ? ` by ${action.createdBy}` : ""}</small>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.leadActionEmpty}>
                      No actions logged yet.
                    </p>
                  )}
                </div>
                </OutreachForm>
              </div>
              <div ref={setFooterTarget} className={styles.leadDialogFooter} />
            </section>
          </div>
        )}
        {deleteTarget && <DeleteLeadModal lead={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onDeleted={() => {
            setLeads((current) => current.filter((lead) => lead.id !== deleteTarget.id));
            setDeleteTarget(null);
            setIsDetailsOpen(false);
            showSnackbar({type: "success", message: "Lead deleted."});
          }} />}
      </main>
    </div>
  );
}
