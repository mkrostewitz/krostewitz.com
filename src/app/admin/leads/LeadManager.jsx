"use client";

import { Dialog, DialogTitle, DialogContent, DialogActions, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Stack, Typography, MenuItem } from "@mui/material";
import { LeadButton, LeadField, LeadAccordion, LeadIconButton } from "./LeadUi";
import { LEAD_STATUS_OPTIONS } from "../../lib/leadStatuses.mjs";
import { groupLeadsByCompany, leadCompanySuggestions } from "../../lib/leadCompanies.mjs";
import { LocateFixed, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLoadingState } from "../../components/loading/LoadingProvider";
import { useSnackbar } from "./LeadSnackbar";
import {LeadRequirementsSettings} from "./LeadRequirements";
import LeadCatalog from "./LeadCatalog";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";
import DisclosureSummary from "./DisclosureSummary";
import LeadTagsAutocomplete from "./LeadTagsAutocomplete";
import { getLeadTypes } from "../../lib/leadTypes.mjs";
import LinkedInProfileButton from "./LinkedInProfileButton";
import OutreachForm from "./OutreachForm";
import LeadMap from "./LeadMap";
import DeleteLeadModal from "./DeleteLeadModal";
import ImportLeadModal from "./ImportLeadModal";
import CreateLeadModal from "./CreateLeadModal";
import outreach from "./outreach.module.css";
import { ACTIVITY_TYPES, CHANNELS, followUpState, localDay, matchesLeadFilters } from "../../lib/leadOutreach.mjs";
const STATUS_OPTIONS = [{
  value: "",
  label: "All statuses"
}, ...LEAD_STATUS_OPTIONS];
const SOURCE_OPTIONS = [{
  value: "",
  label: "All sources"
}, {
  value: "contact_form",
  label: "Contact form"
}, {
  value: "cv_download",
  label: "CV download"
}, {
  value: "manual",
  label: "Personal outreach"
}];
const REQUEST_TYPE_LABELS = {
  general: "General",
  headhunter: "Headhunter",
  employer: "Employer",
  potential_client: "Potential client",
  fan: "Fan",
  other: "Other"
};
const STATUS_LABELS = Object.fromEntries(STATUS_OPTIONS.filter(option => option.value).map(option => [option.value, option.label]));
const SOURCE_LABELS = Object.fromEntries(SOURCE_OPTIONS.filter(option => option.value).map(option => [option.value, option.label]));
function formatDateTime(value) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
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
  return tracking.address || [tracking.city, tracking.state, tracking.country].filter(Boolean).join(", ") || "Unknown";
}
export default function LeadManager({
  user
}) {
  const {
    closeSnackbar,
    showSnackbar
  } = useSnackbar();
  const [leads, setLeads] = useState([]);
  const [leadTypes, setLeadTypes] = useState([]);
  function rememberLeadTypes(types) {
    setLeadTypes(current => [...new Set([...current, ...types])].sort((a, b) => a.localeCompare(b)));
  }
  const [tagFilter, setTagFilter] = useState([]);
  const [activeLeadId, setActiveLeadId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [followUpFilter, setFollowUpFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [footerTarget, setFooterTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [today, setToday] = useState(localDay);
  useEffect(() => {
    const timer = setInterval(() => setToday(localDay()), 60000);
    return () => clearInterval(timer);
  }, []);
  const [companies, setCompanies] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isGeolocating, setIsGeolocating] = useState(false);
  const [savingLeadId, setSavingLeadId] = useState("");
  useLoadingState({
    isLoading,
    label: "Loading leads...",
    type: "page"
  });
  useLoadingState({
    isLoading: Boolean(savingLeadId),
    label: "Saving lead...",
    type: "action"
  });
  useLoadingState({
    isLoading: isGeolocating,
    label: "Geolocating leads...",
    type: "action"
  });
  const activeLead = useMemo(() => leads.find(lead => lead.id === activeLeadId) || null, [activeLeadId, leads]);
  const visibleLeads = useMemo(() => {
    return leads.filter(lead => matchesLeadFilters(lead, {
      status: statusFilter,
      source: sourceFilter,
      search,
      followUp: followUpFilter,
      tags: tagFilter,
      today
    })).sort((a, b) => {
      const aDate = followUpState(a, today) === "closed" ? "9999" : a.followUpOn || "9999";
      const bDate = followUpState(b, today) === "closed" ? "9999" : b.followUpOn || "9999";
      return aDate.localeCompare(bDate) || (b.createdAt || "").localeCompare(a.createdAt || "");
    });
  }, [leads, statusFilter, sourceFilter, search, followUpFilter, tagFilter, today]);
  const companyGroups = useMemo(() => groupLeadsByCompany(visibleLeads), [visibleLeads]);
  // All database pages are loaded above; filters must not narrow autocomplete choices.
  const companyNames = useMemo(() => leadCompanySuggestions([...companies.map(company => ({company: company.name})), ...leads]), [leads, companies]);
  const overdueCount = leads.filter(lead => followUpState(lead, today) === "overdue").length;
  const todayCount = leads.filter(lead => followUpState(lead, today) === "today").length;
  const dueCount = overdueCount + todayCount;
  const counts = useMemo(() => leads.reduce((acc, lead) => {
    acc.total += 1;
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {
    total: 0,
    pending: 0,
    won: 0,
    lost: 0
  }), [leads]);
  useEffect(() => {
    let cancelled = false;
    async function loadLeads() {
      setIsLoading(true);
      try {
        const nextLeads = [];
        // Read every page so older overdue leads cannot disappear behind a limit.
        for (let offset = 0; !cancelled; offset += 300) {
          const response = await fetch(`/api/admin/leads?limit=300&offset=${offset}`, {
            cache: "no-store"
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data.error || "Unable to load leads.");
          if (!cancelled) {setLeadTypes(data.leadTypes || []); setCompanies(data.companies || []);}
          const page = data.leads || [];
          nextLeads.push(...page);
          if (page.length < 300) break;
        }
        if (!cancelled) {
          setLeads([...new Map(nextLeads.map(lead => [lead.id, lead])).values()]);
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) {
          showSnackbar({
            type: "error",
            message: error.message
          });
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
    setActiveLeadId(current => visibleLeads.some(lead => lead.id === current) ? current : visibleLeads[0]?.id || "");
  }, [visibleLeads]);
  useEffect(() => {
    if (isDetailsOpen && !activeLead) {
      setIsDetailsOpen(false);
    }
  }, [activeLead, isDetailsOpen]);
  function leadMatchesCurrentFilters(lead) {
    return matchesLeadFilters(lead, {
      status: statusFilter,
      source: sourceFilter,
      search,
      followUp: followUpFilter,
      tags: tagFilter,
      today
    });
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to update lead.");
      }
      rememberLeadTypes(getLeadTypes(data.lead));
      if (data.companies) setCompanies(data.companies);
      const updated = new Map([...(data.companyLeads || []), data.lead].map(lead => [lead.id, lead]));
      setLeads(current => current.map(lead => updated.get(lead.id) || lead));
      if (!leadMatchesCurrentFilters(data.lead)) {
        setActiveLeadId(current => current === leadId ? "" : current);
        setIsDetailsOpen(false);
      }
      showSnackbar(data.lead.apollo?.status === "error" ? {
        type: "error",
        message: `Lead saved, but Apollo sync failed: ${data.lead.apollo.message}`
      } : {
        type: "success",
        message: data.lead.apollo?.status === "pending" ? `${successMessage} Apollo sync queued in the background.` : successMessage
      });
      return data.lead;
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message
      });
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
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          limit: 100
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Unable to geolocate stored lead IPs.");
      }
      const updatedLeads = Array.isArray(data.leads) ? data.leads : [];
      const updatedById = new Map(updatedLeads.map(lead => [lead.id, lead]));
      if (updatedById.size > 0) {
        setLeads(current => current.map(lead => updatedById.get(lead.id) || lead));
      }
      const summary = data.summary || {};
      const updated = Number(summary.updated) || 0;
      const lookedUp = Number(summary.lookedUp) || 0;
      const failed = Number(summary.failed) || 0;
      const checked = Number(summary.checked) || 0;
      const message = updated > 0 ? `Geolocated ${updated} lead${updated === 1 ? "" : "s"} from ${lookedUp} stored IP lookup${lookedUp === 1 ? "" : "s"}.` : checked > 0 ? `No lead locations changed after ${lookedUp} stored IP lookup${lookedUp === 1 ? "" : "s"}.` : "No stored lead IPs need geolocation.";
      showSnackbar({
        type: failed > 0 && updated === 0 ? "error" : updated > 0 ? "success" : "info",
        message: failed > 0 ? `${message} ${failed} lookup${failed === 1 ? "" : "s"} failed.` : message
      });
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message
      });
    } finally {
      setIsGeolocating(false);
    }
  }
  async function createLead(patch) {
    setSavingLeadId("new");
    try {
      const response = await fetch("/api/admin/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(patch)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Unable to create lead.");
      rememberLeadTypes(getLeadTypes(data.lead));
      if (data.companies) setCompanies(data.companies);
      const updated = new Map((data.companyLeads || []).map(lead => [lead.id, lead]));
      setLeads(current => [data.lead, ...current.map(lead => updated.get(lead.id) || lead)]);
      setStatusFilter("");
      setSourceFilter("");
      setSearch("");
      setFollowUpFilter("");
      setIsCreating(false);
      setTagFilter([]);
      openLeadDetails(data.lead.id);
      showSnackbar({
        type: "success",
        message: "Lead created."
      });
    } catch (error) {
      showSnackbar({
        type: "error",
        message: error.message
      });
      return {
        error: error.message
      };
    } finally {
      setSavingLeadId("");
    }
  }
  return <div className={styles.shell}>
      <AdminHeader active="leads" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={`${styles.toolbar} ${outreach.leadsToolbar}`}>
          <div className={styles.titleBlock}>
            <Typography component="h1" variant="h4">Leads</Typography>
            <Typography className={styles.muted} component="p" variant="body2">
              Track personal outreach, contact requests, and the next follow-up.
            </Typography>
          </div>
          <div className={outreach.headerActions}>
            <LeadRequirementsSettings />
            <LeadCatalog onChange={data => setLeadTypes(data.leadTypes)} />
            <LeadButton type="button" onClick={() => setIsImporting(true)} variant="outlined">Import leads</LeadButton>
            <LeadButton type="button" disabled={isCreating} onClick={() => setIsCreating(true)} variant="contained">Add new lead</LeadButton>
          </div>
        </div>
        {isImporting && <ImportLeadModal onClose={() => setIsImporting(false)} onImported={imported => {
        setTagFilter([]);
        setLeads(current => [...imported, ...current]);
        setStatusFilter('');
        setSearch('');
        setSourceFilter('');
        setFollowUpFilter('');
      }} />}
        {isCreating && <CreateLeadModal leadTypes={leadTypes} companyNames={companyNames} companies={companies} saving={savingLeadId === "new"} onSave={createLead} onClose={() => setIsCreating(false)} />}

        <div className={styles.leadWorkspace}>
          <section className={`${styles.postListPanel} ${outreach.listPanel}`}>
            <section className={outreach.contactMap} aria-labelledby="contact-map-heading">
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <Typography id="contact-map-heading" component="h2" variant="h6">Contact map</Typography>
                <Typography className={styles.muted} component="p" variant="body2">
                  Locations for contacts matching your filters. Select a marker to open contact details.
                </Typography>
              </div>
              <div className={styles.buttonRow}>
                <LeadButton type="button" disabled={isGeolocating || isLoading} title="Geolocate old leads from stored IP addresses" onClick={() => void geolocateStoredLeadIps()} variant="outlined">

                  <LocateFixed aria-hidden="true" size={17} strokeWidth={2.2} />
                  {isGeolocating ? "Geolocating..." : "Geolocate stored IPs"}
                </LeadButton>
              </div>
            </div>

            <LeadMap activeLeadId={activeLead?.id || ""} leads={visibleLeads} onSelectLead={openLeadDetails} mapLabel="Contact locations" />


            </section>
            <div className={outreach.filters}>
              <LeadField type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, company, email, phone…" label={<>Search Contacts - Companies</>}></LeadField>
              <LeadTagsAutocomplete label="Contact type" value={tagFilter} options={leadTypes} onChange={setTagFilter} help="Matches any selected contact type. Clear to show all leads." />
              <LeadField value={statusFilter} onChange={event => setStatusFilter(event.target.value)} label={<>Status</>} select={true}>
                {STATUS_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
              </LeadField>
              <LeadField aria-label="Follow-up" value={followUpFilter} onChange={event => setFollowUpFilter(event.target.value)} label={<>Follow-up</>} select={true}>
                <MenuItem value="">All follow-ups</MenuItem><MenuItem value="due">Due today & overdue</MenuItem><MenuItem value="overdue">Overdue</MenuItem><MenuItem value="today">Today</MenuItem><MenuItem value="upcoming">Upcoming</MenuItem><MenuItem value="unscheduled">No follow-up scheduled</MenuItem>
              </LeadField>
              <LeadField aria-label="Source" value={sourceFilter} onChange={event => setSourceFilter(event.target.value)} label={<>Source</>} select={true}>{SOURCE_OPTIONS.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}</LeadField>
            </div>
            <div className={styles.leadStats} aria-label="Lead status filters">
              {[{
              value: "",
              label: "total",
              count: counts.total
            }, {
              value: "pending",
              label: "pending",
              count: counts.pending || 0
            }, {
              value: "won",
              label: "won",
              count: counts.won || 0
            }, {
              value: "lost",
              label: "lost",
              count: counts.lost || 0
            }].map(chip => <LeadButton key={chip.value || "total"} type="button" aria-pressed={statusFilter === chip.value && !followUpFilter} onClick={() => {
              setStatusFilter(chip.value);
              setFollowUpFilter("");
            }} variant="outlined">

                  {chip.count} {chip.label}
                </LeadButton>)}
              {[{
              value: "overdue",
              label: "Overdue",
              count: overdueCount
            }, {
              value: "today",
              label: "Due today",
              count: todayCount
            }].map(chip => <LeadButton key={chip.value} type="button" aria-pressed={followUpFilter === chip.value} onClick={() => {
              setFollowUpFilter(followUpFilter === chip.value ? "" : chip.value);
              setStatusFilter("");
              setSourceFilter("");
              setSearch("");
            }} variant="outlined">
                {chip.count} {chip.label}</LeadButton>)}
              <LeadButton type="button" aria-pressed={followUpFilter === "due"} onClick={() => {
              setFollowUpFilter("due");
              setStatusFilter("");
              setSourceFilter("");
              setSearch("");
            }} variant="outlined">{dueCount} follow-ups due</LeadButton>
            </div>

            <div className={outreach.listSummary}>
              <strong>{visibleLeads.length} contact{visibleLeads.length === 1 ? "" : "s"} <span>in {companyGroups.length} group{companyGroups.length === 1 ? "" : "s"}</span></strong>
              <span>Earliest follow-up first within each company</span>
            </div>
            <Stack spacing={2} aria-label="Leads">
              {companyGroups.map(group => <LeadAccordion key={group.key} open>
                <DisclosureSummary><strong>{group.name || "No company"}</strong><small>{group.leads.length} contacts</small></DisclosureSummary>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small" aria-label={`${group.name || "No company"} contacts`} sx={{
                  minWidth: 750
                }}>
                    <TableHead><TableRow>{["Lead", "Outreach", "Status", "Latest activity", "Next follow-up"].map(title => <TableCell key={title}>{title}</TableCell>)}</TableRow></TableHead>
                    <TableBody>{group.leads.map(lead => <TableRow hover selected={activeLead?.id === lead.id} key={lead.id}
                      sx={{cursor: "pointer"}}
                      onClick={(event) => {
                        // Links and buttons keep their own action; the remaining row opens details.
                        if (event.target.closest("a, button, input, select, textarea, [role='button']")) return;
                        openLeadDetails(lead.id);
                      }}>
                      <TableCell component="th" scope="row"><Stack spacing={.75}>
                        <Stack direction="row" spacing={1} sx={{alignItems: "center"}}>
                          <LeadButton variant="text" onClick={() => openLeadDetails(lead.id)} sx={{
                              justifyContent: "flex-start",
                              p: 0,
                              minHeight: 32
                            }}>{leadTitle(lead)}</LeadButton>
                          <LinkedInProfileButton value={lead.linkedinUrl} label={`Open ${leadTitle(lead)} on LinkedIn in a new tab`} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">{lead.role || lead.email}</Typography>
                        <Stack direction="row" spacing={.5} useFlexGap sx={{flexWrap: "wrap"}}>{getLeadTypes(lead).map(tag => <Chip key={tag} label={tag} size="small" variant="outlined" />)}</Stack>
                      </Stack></TableCell>
                      <TableCell><Typography variant="body2">{CHANNELS[lead.preferredChannel] || "LinkedIn"}</Typography><Typography variant="caption" color="text.secondary">{sourceLabel(lead)}</Typography></TableCell>
                      <TableCell><Chip size="small" label={STATUS_LABELS[lead.status] || lead.status} color={lead.status === "won" ? "success" : lead.status === "lost" ? "error" : "default"} variant="outlined" /></TableCell>
                      <TableCell sx={{
                        maxWidth: 260
                      }}><Typography variant="body2">{leadActions(lead)[0]?.occurredOn || (leadActions(lead)[0]?.createdAt ? formatDateTime(leadActions(lead)[0].createdAt) : "No activity yet")}</Typography><Typography variant="caption" color="text.secondary">{actionsPreview(lead)}</Typography></TableCell>
                      <TableCell><Stack spacing={.5} sx={{alignItems: "flex-start"}}><Typography variant="body2">{lead.followUpOn || "Not scheduled"}</Typography>
                        {["overdue", "today"].includes(followUpState(lead, today)) && <Chip size="small" color={followUpState(lead, today) === "overdue" ? "error" : "warning"} label={followUpState(lead, today) === "overdue" ? "Overdue" : "Due today"} />}
                        {lead.followUpTask && <Typography variant="caption">{lead.followUpTask}</Typography>}
                      </Stack></TableCell>
                    </TableRow>)}</TableBody>
                  </Table>
                </TableContainer>
              </LeadAccordion>)}
              {!isLoading && visibleLeads.length === 0 && <Typography color="text.secondary" sx={{
              p: 3
            }}>No leads match this view.</Typography>}
            </Stack>
          </section>
        </div>

        {isDetailsOpen && activeLead && <Dialog open maxWidth="md" aria-labelledby="lead-details-title" onClose={() => {
        if (!savingLeadId) setIsDetailsOpen(false);
      }}>
              <DialogTitle component="div" sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2
        }}>
                <div className={styles.titleBlock}>
                  <Typography id="lead-details-title" component="h2" variant="h6">{leadTitle(activeLead)}</Typography>
                  <Typography className={styles.muted} component="p" variant="body2">{[activeLead.company, activeLead.role, ...getLeadTypes(activeLead), sourceLabel(activeLead)].filter(Boolean).join(" · ")}</Typography>
                </div>
                <div className={styles.leadModalHeaderActions}>
                  <Chip size="small" label={STATUS_LABELS[activeLead.status] || activeLead.status} />
                  <LeadIconButton type="button" disabled={Boolean(savingLeadId)} aria-label="Close lead details" title="Close" onClick={() => setIsDetailsOpen(false)}>

                    <X aria-hidden="true" size={18} strokeWidth={2.3} />
                  </LeadIconButton>
                </div>
              </DialogTitle>

              <DialogContent dividers sx={{
          display: "grid",
          gap: 2
        }}>
                {activeLead.source?.type !== "manual" && <LeadAccordion>
                  <DisclosureSummary>Inbound lead details</DisclosureSummary>
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

                {activeLead.message && <div className={styles.leadMessage}>
                    <span>Message</span>
                    <Typography component="p" variant="body2">{activeLead.message}</Typography>
                  </div>}

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
                      {activeLead.tracking?.pageUrl || activeLead.tracking?.referrer || "Unknown"}
                    </strong>
                  </div>
                  <div className={styles.leadWideDetail}>
                    <span>User agent</span>
                    <strong>{activeLead.tracking?.userAgent || "Unknown"}</strong>
                  </div>
                </div>

                </LeadAccordion>}

                <OutreachForm leadTypes={leadTypes} companyNames={companyNames} companies={companies} key={`${activeLead.id}:${activeLead.updatedAt}`} lead={activeLead} footerTarget={footerTarget} onCancel={() => setIsDetailsOpen(false)} onDelete={() => setDeleteTarget(activeLead)} saving={savingLeadId === activeLead.id} onSave={patch => updateLead(activeLead.id, patch, "Lead updated.")}>


                <div className={styles.leadActionSection}>
                  {leadActions(activeLead).length > 0 ? <div className={styles.leadActionList}>
                      {leadActions(activeLead).map(action => <article key={action.id} className={styles.leadActionItem}>
                          <div className={styles.leadActionMeta}>
                            <strong>
                              {action.legacy ? "Legacy note" : `${ACTIVITY_TYPES[action.type] || "Note"} · ${CHANNELS[action.channel] || "Other"}`}
                            </strong>
                            <span>{action.occurredOn || formatDateTime(action.createdAt)}</span>
                          </div>
                          <Typography component="p" variant="body2">{action.text}</Typography>
                          <small className={styles.muted}>Logged {formatDateTime(action.createdAt)}{action.createdBy ? ` by ${action.createdBy}` : ""}</small>
                        </article>)}
                    </div> : <Typography className={styles.leadActionEmpty} component="p" variant="body2">
                      No actions logged yet.
                    </Typography>}
                </div>
                </OutreachForm>
              </DialogContent>
              <DialogActions ref={setFooterTarget} sx={{
          p: 2
        }} />
          </Dialog>}
        {deleteTarget && <DeleteLeadModal lead={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => {
        setLeads(current => current.filter(lead => lead.id !== deleteTarget.id));
        setDeleteTarget(null);
        setIsDetailsOpen(false);
        showSnackbar({
          type: "success",
          message: "Lead deleted."
        });
      }} />}
      </main>
    </div>;
}
