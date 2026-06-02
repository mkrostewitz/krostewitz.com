"use client";

import {Sparkles, X} from "lucide-react";
import Link from "next/link";
import {useEffect, useMemo, useRef, useState} from "react";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import {FALLBACK_LANGUAGE} from "@/lib/languageDetection";
import {
  getSiteLanguageLabel,
  SITE_LANGUAGES,
} from "@/lib/siteLanguages";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
const LINKEDIN_IMAGE_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
]);
const LINKEDIN_SHARE_REQUEST_TIMEOUT_MS = 60000;
const SHARE_EMOJIS = ["💡", "📈", "🤖", "🏭", "🌍", "✅"];
const FALLBACK_TIME_ZONE = "Europe/Berlin";
const FALLBACK_TIME_ZONES = [
  "Europe/Berlin",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function formatDate(value) {
  if (!value) return "Not saved";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value, timeZone) {
  if (!value) return "Not scheduled";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not scheduled";

  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZone: timeZone || undefined,
      timeZoneName: timeZone ? "short" : undefined,
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
}

function normalizeListCategories(value) {
  return (Array.isArray(value) ? value : [])
    .map((category) => ({
      label: String(category?.label || category?.name || category || "").trim(),
      slug: String(category?.slug || "").trim(),
    }))
    .filter((category) => category.label);
}

function getCategoryKey(category) {
  return category.slug || category.label.toLowerCase();
}

function normalizeTranslation(value = {}) {
  return {
    title: String(value.title || ""),
    summary: String(value.summary || ""),
    contentHtml: String(value.contentHtml || ""),
  };
}

function translationHasContent(translation) {
  const normalized = normalizeTranslation(translation);

  return Boolean(
    normalized.title.trim() ||
      normalized.summary.trim() ||
      normalized.contentHtml.replace(/<[^>]*>/g, " ").trim()
  );
}

function getShareableLanguages(post) {
  const translations = post?.translations || {};
  const languages = SITE_LANGUAGES.filter((language) =>
    translationHasContent(translations[language.code])
  );

  return languages.length > 0 ? languages : SITE_LANGUAGES;
}

function getDefaultShareLanguage(post) {
  const languages = getShareableLanguages(post);

  return languages.some((language) => language.code === FALLBACK_LANGUAGE)
    ? FALLBACK_LANGUAGE
    : languages[0]?.code || FALLBACK_LANGUAGE;
}

function getPostTranslation(post, language) {
  const requested = normalizeTranslation(post?.translations?.[language]);

  if (translationHasContent(requested)) return requested;

  return normalizeTranslation(
    post?.translations?.[FALLBACK_LANGUAGE] || {
      title: post?.title,
      summary: post?.summary,
      contentHtml: post?.contentHtml,
    }
  );
}

function padDatePart(value) {
  return String(value).padStart(2, "0");
}

function getDefaultTimeZone() {
  return (
    Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIME_ZONE
  );
}

function getTimeZoneOptions(selectedTimeZone) {
  const supportedTimeZones =
    typeof Intl.supportedValuesOf === "function"
      ? Intl.supportedValuesOf("timeZone")
      : FALLBACK_TIME_ZONES;

  return [...new Set([selectedTimeZone, ...FALLBACK_TIME_ZONES, ...supportedTimeZones])]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
}

function getTimeZoneLabel(timeZone) {
  try {
    const label = new Intl.DateTimeFormat("en", {
      timeZone,
      timeZoneName: "short",
    })
      .formatToParts(new Date())
      .find((part) => part.type === "timeZoneName")?.value;

    return label ? `${timeZone} (${label})` : timeZone;
  } catch {
    return timeZone;
  }
}

function getTimeZoneDateParts(value, timeZone) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  }).formatToParts(value);
  const partMap = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return {
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
    month: Number(partMap.month),
    second: Number(partMap.second),
    year: Number(partMap.year),
  };
}

function toDateTimeLocalValue(value, timeZone = getDefaultTimeZone()) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  try {
    const parts = getTimeZoneDateParts(date, timeZone);

    return `${parts.year}-${padDatePart(parts.month)}-${padDatePart(
      parts.day
    )}T${padDatePart(parts.hour)}:${padDatePart(parts.minute)}`;
  } catch {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
  }
}

function parseDateTimeLocalValue(value) {
  const match = String(value || "").match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (!match) return null;

  return {
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    month: Number(match[2]),
    year: Number(match[1]),
  };
}

function getTimeZoneOffsetMs(date, timeZone) {
  const parts = getTimeZoneDateParts(date, timeZone);
  const utcTime = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second || 0
  );

  return utcTime - date.getTime();
}

function toIsoDateTimeValue(value, timeZone = getDefaultTimeZone()) {
  if (!value) return "";

  const parts = parseDateTimeLocalValue(value);

  if (!parts) return "";

  try {
    const localUtcTime = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      0
    );
    const initialOffset = getTimeZoneOffsetMs(new Date(localUtcTime), timeZone);
    let utcTime = localUtcTime - initialOffset;
    const finalOffset = getTimeZoneOffsetMs(new Date(utcTime), timeZone);

    if (finalOffset !== initialOffset) {
      utcTime = localUtcTime - finalOffset;
    }

    const date = new Date(utcTime);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  } catch {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }
}

function getImageContentTypeFromUrl(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) {
      return "image/jpeg";
    }
    if (pathname.endsWith(".png")) return "image/png";
  } catch {
    return "";
  }

  return "";
}

function normalizeImageContentType(value) {
  const contentType = String(value || "")
    .split(";")[0]
    .trim()
    .toLowerCase();

  return contentType === "image/jpg" ? "image/jpeg" : contentType;
}

function getSupportedLinkedInImageContentType(media) {
  const contentType =
    normalizeImageContentType(media?.mimeType) ||
    getImageContentTypeFromUrl(media?.url);

  return LINKEDIN_IMAGE_CONTENT_TYPES.has(contentType) ? contentType : "";
}

function canIncludeLinkedInImage(post) {
  const media = post?.media;

  if (media?.type !== "image" || !media.url) return false;

  return Boolean(
    getSupportedLinkedInImageContentType(media) ||
      !normalizeImageContentType(media.mimeType)
  );
}

function getShareImageStatus(post) {
  const media = post?.media;

  if (!media) return "No image is attached to this post.";
  if (media.type !== "image") return "Only attached images can be posted to LinkedIn.";
  if (!canIncludeLinkedInImage(post)) {
    return "LinkedIn accepts JPG, PNG, and GIF images for image posts.";
  }

  return media.fileName || "Attached blog image";
}

const SHARE_HISTORY_STATUS_LABELS = {
  canceled: "Canceled",
  due: "Due",
  failed: "Failed",
  processing: "Processing",
  published: "Published",
  scheduled: "Scheduled",
};

async function loadPostManagerData() {
  const [postsResponse, linkedinResponse] = await Promise.all([
    fetch("/api/admin/posts", {cache: "no-store"}),
    fetch("/api/admin/linkedin", {cache: "no-store"}),
  ]);
  const postsData = await postsResponse.json().catch(() => ({}));
  const linkedinData = await linkedinResponse.json().catch(() => ({}));

  if (!postsResponse.ok) {
    throw new Error(postsData.error || "Unable to load posts.");
  }

  return {
    integration: linkedinResponse.ok ? linkedinData.integration || {} : null,
    posts: postsData.posts || [],
  };
}

function getScheduleTime(entry) {
  const time = entry?.scheduledAt ? new Date(entry.scheduledAt).getTime() : 0;

  return Number.isFinite(time) ? time : 0;
}

function isScheduledShareDue(entry, now = Date.now()) {
  const scheduleTime = getScheduleTime(entry);

  return entry?.status === "scheduled" && scheduleTime > 0 && scheduleTime <= now;
}

function getShareHistoryDisplayStatus(entry) {
  return isScheduledShareDue(entry) ? "due" : entry.status || "scheduled";
}

function getShareHistoryStatusTime(entry) {
  return (
    entry.failedAt ||
    entry.publishedAt ||
    entry.canceledAt ||
    entry.processingStartedAt ||
    entry.sharedAt ||
    entry.attemptedAt ||
    entry.scheduledAt ||
    entry.createdAt
  );
}

function getShareHistoryStatusClass(status) {
  if (status === "due") return styles.shareHistoryStatusDue;
  if (status === "failed") return styles.shareHistoryStatusFailed;
  if (status === "published") return styles.shareHistoryStatusPublished;
  if (status === "canceled") return styles.shareHistoryStatusCanceled;
  if (status === "processing") return styles.shareHistoryStatusProcessing;
  return "";
}

function getSchedulerSourceLabel(value) {
  const source = String(value || "").trim().toLowerCase();

  if (source === "netlify") return "Netlify";
  if (source === "manual") return "Manual check";

  return source || "Unknown source";
}

function getSchedulerStatusText(linkedin) {
  if (!linkedin?.schedulerConfigured) return "";

  if (!linkedin.schedulerLastRunAt) {
    return "No scheduler checks recorded yet. Netlify may not have invoked the scheduled function.";
  }

  const results = Array.isArray(linkedin.schedulerLastResults)
    ? linkedin.schedulerLastResults
    : [];
  const checked = Math.max(0, Number(linkedin.schedulerLastChecked) || 0);
  const published = results.filter((result) => result.status === "published").length;
  const failed = results.filter((result) => result.status === "failed").length;
  const parts = [
    `Last scheduler check ${formatDateTime(linkedin.schedulerLastRunAt)}`,
    getSchedulerSourceLabel(linkedin.schedulerLastRunSource),
    `${checked} checked`,
  ];

  if (published > 0) {
    parts.push(`${published} published`);
  }

  if (failed > 0) {
    parts.push(`${failed} failed`);
  }

  if (linkedin.schedulerLastError) {
    parts.push(linkedin.schedulerLastError);
  }

  return parts.join(" · ");
}

function getLinkedInShareHistory(post) {
  const schedules = Array.isArray(post?.linkedinShareSchedules)
    ? post.linkedinShareSchedules
    : [];
  const shares = Array.isArray(post?.linkedinShares) ? post.linkedinShares : [];
  const attempts = Array.isArray(post?.linkedinShareAttempts)
    ? post.linkedinShareAttempts
    : [];
  const sharesByJobId = new Map(
    shares
      .filter((share) => share.scheduledJobId)
      .map((share) => [share.scheduledJobId, share])
  );
  const scheduledJobIds = new Set(
    schedules.map((schedule) => schedule.jobId).filter(Boolean)
  );
  const scheduleHistory = schedules.map((schedule) => {
    const linkedShare = sharesByJobId.get(schedule.jobId);

    return {
      id: `schedule-${schedule.jobId || schedule.createdAt}`,
      account: schedule.account,
      commentary: schedule.commentary,
      createdAt: schedule.createdAt,
      failedAt: schedule.failedAt,
      failure: schedule.failure,
      includeImage: schedule.includeImage,
      jobId: schedule.jobId,
      kind: "Scheduled share",
      language: schedule.language,
      linkedInPostUrl: schedule.linkedInPostUrl || linkedShare?.postUrl || "",
      processingStartedAt: schedule.processingStartedAt,
      publishedAt: schedule.publishedAt,
      canceledAt: schedule.canceledAt,
      scheduledAt: schedule.scheduledAt,
      scheduledTimeZone: schedule.scheduledTimeZone,
      status: schedule.status || "scheduled",
      target: schedule.target || "personal_profile",
    };
  });
  const immediateSuccessHistory = shares
    .filter((share) => !share.scheduledJobId || !scheduledJobIds.has(share.scheduledJobId))
    .map((share) => ({
      id: `share-${share.postUrn || share.sharedAt}`,
      account: share.account,
      commentary: share.commentary,
      kind: "Immediate share",
      language: share.language,
      linkedInPostUrl: share.postUrl,
      publishedAt: share.sharedAt,
      sharedAt: share.sharedAt,
      status: "published",
    }));
  const failedAttemptHistory = attempts.map((attempt) => ({
    id: `attempt-${attempt.attemptedAt || attempt.createdAt}`,
    account: attempt.account,
    attemptedAt: attempt.attemptedAt,
    commentary: attempt.commentary,
    failedAt: attempt.failedAt,
    failure: attempt.failure,
    includeImage: attempt.includeImage,
    kind: attempt.attemptType === "scheduled" ? "Scheduled share" : "Immediate share",
    language: attempt.language,
    status: attempt.status || "failed",
  }));

  return [
    ...scheduleHistory,
    ...immediateSuccessHistory,
    ...failedAttemptHistory,
  ].sort((left, right) => {
    const leftTime = new Date(getShareHistoryStatusTime(left) || 0).getTime();
    const rightTime = new Date(getShareHistoryStatusTime(right) || 0).getTime();
    return rightTime - leftTime;
  });
}

export default function PostManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [posts, setPosts] = useState([]);
  const [linkedin, setLinkedin] = useState({
    available: false,
    connected: false,
    needsReconnect: false,
    profile: null,
    schedulerConfigured: false,
    schedulerEnabled: false,
    schedulerLastChecked: null,
    schedulerLastError: "",
    schedulerLastResults: [],
    schedulerLastRunAt: null,
    schedulerLastRunSource: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnectingLinkedin, setIsDisconnectingLinkedin] = useState(false);
  const [cancelingScheduleId, setCancelingScheduleId] = useState("");
  const [isRunningScheduler, setIsRunningScheduler] = useState(false);
  const [sharingPostId, setSharingPostId] = useState("");
  const [pendingSharePost, setPendingSharePost] = useState(null);
  const [pendingShareSchedule, setPendingShareSchedule] = useState(null);
  const [shareTarget, setShareTarget] = useState("personal_profile");
  const [shareLanguage, setShareLanguage] = useState(FALLBACK_LANGUAGE);
  const [shareCommentary, setShareCommentary] = useState("");
  const [shareIncludeImage, setShareIncludeImage] = useState(false);
  const [shareTiming, setShareTiming] = useState("now");
  const [shareScheduledAt, setShareScheduledAt] = useState("");
  const [shareTimeZone, setShareTimeZone] = useState(getDefaultTimeZone);
  const [isGeneratingThoughts, setIsGeneratingThoughts] = useState(false);
  const shareThoughtsRef = useRef(null);
  const timeZoneOptions = useMemo(
    () => getTimeZoneOptions(shareTimeZone),
    [shareTimeZone]
  );
  const pendingShareHistory = useMemo(
    () => getLinkedInShareHistory(pendingSharePost).slice(0, 8),
    [pendingSharePost]
  );
  const pendingShareHasDueSchedules = pendingShareHistory.some((entry) =>
    isScheduledShareDue(entry)
  );
  const dueLinkedInScheduleCount = useMemo(
    () =>
      posts.reduce(
        (count, post) =>
          count +
          (Array.isArray(post.linkedinShareSchedules)
            ? post.linkedinShareSchedules.filter((schedule) =>
                isScheduledShareDue(schedule)
              ).length
            : 0),
        0
      ),
    [posts]
  );
  const schedulerStatusText = useMemo(
    () => getSchedulerStatusText(linkedin),
    [linkedin]
  );

  const counts = useMemo(
    () =>
      posts.reduce(
        (acc, post) => {
          acc[post.status] = (acc[post.status] || 0) + 1;
          return acc;
        },
        {draft: 0, published: 0, archived: 0}
      ),
    [posts]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      try {
        const data = await loadPostManagerData();

        if (!cancelled) {
          setPosts(data.posts);
          if (data.integration) {
            setLinkedin((current) => ({
              ...current,
              ...data.integration,
            }));
          }
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

    loadPosts();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar]);

  async function refreshPostManagerData(activePostId = "") {
    const data = await loadPostManagerData();

    setPosts(data.posts);
    if (data.integration) {
      setLinkedin((current) => ({
        ...current,
        ...data.integration,
      }));
    }
    if (activePostId) {
      const updatedPost = data.posts.find((post) => post.id === activePostId);
      if (updatedPost) {
        setPendingSharePost(updatedPost);
      }
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const linkedInStatus = params.get("linkedin");
    const linkedInError = params.get("linkedin_error");

    if (linkedInStatus === "connected") {
      showSnackbar({
        type: "success",
        message: "LinkedIn publishing is connected.",
      });
    } else if (linkedInError === "account_mismatch") {
      showSnackbar({
        type: "error",
        message: "Connect the same LinkedIn email as the current admin account.",
      });
    } else if (linkedInError === "not_configured") {
      showSnackbar({
        type: "error",
        message: "LinkedIn publishing is not configured yet.",
      });
    }

    if (linkedInStatus || linkedInError) {
      params.delete("linkedin");
      params.delete("linkedin_error");
      const nextUrl = `${window.location.pathname}${
        params.toString() ? `?${params.toString()}` : ""
      }${window.location.hash}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }, [showSnackbar]);

  async function disconnectLinkedIn() {
    setIsDisconnectingLinkedin(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/linkedin", {method: "DELETE"});
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to disconnect LinkedIn.");
      }

      setLinkedin((current) => ({
        ...current,
        ...(data.integration || {}),
      }));
      showSnackbar({type: "success", message: "LinkedIn disconnected."});
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsDisconnectingLinkedin(false);
    }
  }

  async function runDueLinkedInShares() {
    setIsRunningScheduler(true);
    closeSnackbar();

    try {
      const response = await fetch("/api/admin/linkedin/scheduled", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({limit: 5}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to run LinkedIn scheduler.");
      }

      const results = Array.isArray(data.results) ? data.results : [];
      const publishedCount = results.filter(
        (result) => result.status === "published"
      ).length;
      const failedResults = results.filter((result) => result.status === "failed");
      const firstFailure = failedResults[0]?.error || "";

      await refreshPostManagerData(pendingSharePost?.id || "");

      if (Number(data.checked) === 0) {
        showSnackbar({
          type: "success",
          message: "No due LinkedIn scheduled shares were found.",
        });
      } else if (failedResults.length > 0) {
        showSnackbar({
          type: "error",
          message: firstFailure
            ? `LinkedIn scheduler published ${publishedCount} and failed ${failedResults.length}: ${firstFailure}`
            : `LinkedIn scheduler published ${publishedCount} and failed ${failedResults.length}.`,
        });
      } else {
        showSnackbar({
          type: "success",
          message: `LinkedIn scheduler published ${publishedCount} due share${
            publishedCount === 1 ? "" : "s"
          }.`,
        });
      }
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsRunningScheduler(false);
    }
  }

  function openShareDialog(post, schedule = null) {
    const scheduleTimeZone = schedule?.scheduledTimeZone || getDefaultTimeZone();

    setShareTarget(schedule?.target || "personal_profile");
    setShareLanguage(schedule?.language || getDefaultShareLanguage(post));
    setShareCommentary(schedule?.commentary || "");
    setShareIncludeImage(
      schedule ? schedule.includeImage === true : canIncludeLinkedInImage(post)
    );
    setShareTiming(schedule ? "scheduled" : "now");
    setShareScheduledAt(
      schedule?.scheduledAt
        ? toDateTimeLocalValue(schedule.scheduledAt, scheduleTimeZone)
        : ""
    );
    setShareTimeZone(scheduleTimeZone);
    setPendingShareSchedule(schedule);
    setPendingSharePost(post);
  }

  function closeShareDialog() {
    if (sharingPostId || isGeneratingThoughts) return;
    setPendingShareSchedule(null);
    setPendingSharePost(null);
  }

  function insertShareEmoji(emoji) {
    const textarea = shareThoughtsRef.current;

    if (!textarea) {
      setShareCommentary((current) => `${current}${emoji}`);
      return;
    }

    const start = textarea.selectionStart ?? shareCommentary.length;
    const end = textarea.selectionEnd ?? shareCommentary.length;
    const nextValue = `${shareCommentary.slice(0, start)}${emoji}${shareCommentary.slice(end)}`;
    const nextCursor = start + emoji.length;

    setShareCommentary(nextValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function generateShareThoughts(post) {
    setIsGeneratingThoughts(true);
    closeSnackbar();

    try {
      const response = await fetch(
        `/api/admin/posts/${post.id}/linkedin/thoughts`,
        {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            currentThoughts: shareCommentary,
            language: shareLanguage,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate LinkedIn thoughts.");
      }

      setShareCommentary(data.thoughts || "");
      showSnackbar({
        type: "success",
        message: "LinkedIn thoughts generated.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setIsGeneratingThoughts(false);
    }
  }

  async function sharePostToLinkedIn(post, options = {}) {
    if (!linkedin.connected || linkedin.needsReconnect) {
      showSnackbar({
        type: "error",
        message: "Connect LinkedIn before sharing posts.",
      });
      return;
    }

    if (options.timing === "scheduled" && !linkedin.schedulerConfigured) {
      showSnackbar({
        type: "error",
        message:
          "Enable the LinkedIn scheduler before scheduling posts.",
      });
      return;
    }

    const scheduledAt =
      options.timing === "scheduled"
        ? toIsoDateTimeValue(options.scheduledAt, options.timeZone)
        : "";

    if (options.timing === "scheduled" && !scheduledAt) {
      showSnackbar({type: "error", message: "Choose a valid schedule time."});
      return;
    }

    setSharingPostId(post.id);
    closeSnackbar();

    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      LINKEDIN_SHARE_REQUEST_TIMEOUT_MS
    );

    try {
      const response = await fetch(`/api/admin/posts/${post.id}/linkedin`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        signal: controller.signal,
        body: JSON.stringify({
          commentary: options.commentary,
          includeImage: options.includeImage,
          language: options.language,
          scheduledAt,
          scheduledJobId: options.scheduledJobId,
          scheduledTimeZone: options.timeZone,
          target: options.target,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (data.post) {
          setPosts((current) =>
            current.map((item) => (item.id === post.id ? data.post : item))
          );
          setPendingSharePost((current) =>
            current?.id === post.id ? data.post : current
          );
        }

        if (response.status === 401) {
          setLinkedin((current) => ({
            ...current,
            needsReconnect: true,
          }));
        }

        throw new Error(data.error || "Unable to share post to LinkedIn.");
      }

      setPosts((current) =>
        current.map((item) => (item.id === post.id ? data.post : item))
      );
      setLinkedin((current) => ({
        ...current,
        lastPublishedAt: data.linkedin?.sharedAt || current.lastPublishedAt,
      }));
      showSnackbar(
        data.scheduled
          ? {
              type: "success",
              message: `LinkedIn share ${
                data.updated ? "updated" : "queued"
              } for ${formatDateTime(
                data.linkedin?.scheduledAt,
                data.linkedin?.scheduledTimeZone || options.timeZone
              )}. Netlify checks due shares every minute.`,
            }
          : {
              type: "success",
              message: "Post shared to LinkedIn.",
            }
      );
      setPendingShareSchedule(null);
      setPendingSharePost(null);
    } catch (error) {
      const isAbortError = error?.name === "AbortError";
      showSnackbar({
        type: "error",
        message: isAbortError
          ? "LinkedIn request took too long to confirm. Refresh the posts list and try again if it was not queued or posted."
          : error.message,
      });
    } finally {
      window.clearTimeout(timeoutId);
      setSharingPostId("");
    }
  }

  async function cancelLinkedInSchedule(post, schedule) {
    if (!schedule?.jobId) return;

    const shouldCancel = window.confirm(
      "Cancel this scheduled LinkedIn share?"
    );

    if (!shouldCancel) return;

    setCancelingScheduleId(schedule.jobId);
    closeSnackbar();

    try {
      const response = await fetch(`/api/admin/posts/${post.id}/linkedin`, {
        method: "DELETE",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({jobId: schedule.jobId}),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to cancel scheduled share.");
      }

      setPosts((current) =>
        current.map((item) => (item.id === post.id ? data.post : item))
      );
      showSnackbar({
        type: "success",
        message: "Scheduled LinkedIn share canceled.",
      });
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      setCancelingScheduleId("");
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="posts" user={user} />

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>Posts</h1>
            <p className={styles.muted}>
              Create blog posts with rich text and hosted media.
            </p>
          </div>
        </div>

        <div className={styles.postWorkspace}>
          <section className={styles.linkedinPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>LinkedIn publishing</h2>
                <p className={styles.muted}>
                  Share published blog posts to the connected LinkedIn member.
                </p>
              </div>
              <span
                className={`${styles.statusBadge} ${
                  linkedin.connected
                    ? linkedin.needsReconnect
                      ? styles.statusBadgeWarning
                      : styles.statusBadgeSuccess
                    : ""
                }`}
              >
                {linkedin.connected
                  ? linkedin.needsReconnect
                    ? "Reconnect"
                    : "Connected"
                  : "Not connected"}
              </span>
            </div>

            <div className={styles.linkedinStatusGrid}>
              <div className={styles.linkedinAccount}>
                <strong>
                  {linkedin.connected
                    ? linkedin.profile?.name || linkedin.profile?.email
                    : "No LinkedIn account connected"}
                </strong>
                <span>
                  {linkedin.connected
                    ? linkedin.profile?.email
                    : linkedin.available
                    ? "Connect LinkedIn before sharing posts."
                    : "Enable LinkedIn auth and configure app credentials first."}
                </span>
                {linkedin.accessTokenExpiresAt && (
                  <span>
                    {linkedin.needsReconnect
                      ? "Reconnect LinkedIn before sharing posts."
                      : `Token expires ${formatDate(
                          linkedin.accessTokenExpiresAt
                        )}`}
                  </span>
                )}
                {linkedin.schedulerConfigured && dueLinkedInScheduleCount > 0 && (
                  <span>
                    {dueLinkedInScheduleCount} scheduled LinkedIn share
                    {dueLinkedInScheduleCount === 1 ? " is" : "s are"} due.
                    Run the scheduler to publish or reveal the failure reason.
                  </span>
                )}
                {linkedin.schedulerConfigured && schedulerStatusText && (
                  <span
                    className={
                      linkedin.schedulerLastError
                        ? styles.linkedinSchedulerWarning
                        : styles.linkedinSchedulerStatus
                    }
                  >
                    {schedulerStatusText}
                  </span>
                )}
              </div>

              <div className={styles.buttonRow}>
                {linkedin.available && (
                  <a
                    className={`${styles.secondaryButton} ${styles.linkedinReconnectButton}`}
                    href="/api/admin/linkedin/connect"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {linkedin.connected ? "Reconnect" : "Connect LinkedIn"}
                  </a>
                )}
                {linkedin.connected && (
                  <button
                    className={`${styles.ghostButton} ${styles.linkedinDisconnectButton}`}
                    disabled={isDisconnectingLinkedin}
                    type="button"
                    onClick={disconnectLinkedIn}
                  >
                    {isDisconnectingLinkedin ? "Disconnecting..." : "Disconnect"}
                  </button>
                )}
                {linkedin.schedulerConfigured && (
                  <button
                    className={styles.secondaryButton}
                    disabled={
                      isRunningScheduler ||
                      !linkedin.connected ||
                      linkedin.needsReconnect
                    }
                    type="button"
                    onClick={runDueLinkedInShares}
                  >
                    {isRunningScheduler
                      ? "Running..."
                      : dueLinkedInScheduleCount > 0
                      ? `Run due shares (${dueLinkedInScheduleCount})`
                      : "Check due shares"}
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className={styles.postListPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>All posts</h2>
                <p className={styles.muted}>
                  {counts.draft} drafts · {counts.published} published ·{" "}
                  {counts.archived} archived
                </p>
              </div>
              <Link
                className={styles.secondaryButton}
                href="/admin/posts/new"
              >
                New post
              </Link>
            </div>

            <div className={styles.postList} aria-label="Posts">
              <div className={styles.postListHeader} aria-hidden="true">
                <span>Post</span>
                <span>Status</span>
                <span>Updated</span>
                <span>Categories</span>
                <span>Action</span>
              </div>

              {posts.map((post) => {
                const categories = normalizeListCategories(post.categories);
                const visibleCategories = categories.slice(0, 3);
                const extraCategoryCount = categories.length - visibleCategories.length;
                const editHref = `/admin/posts/${post.id}`;
                const latestLinkedInShare = post.linkedinShares?.[0];
                const latestLinkedInHistory = getLinkedInShareHistory(post)[0];
                const dueLinkedInSchedule = post.linkedinShareSchedules?.find(
                  (schedule) => isScheduledShareDue(schedule)
                );
                const nextLinkedInSchedule = post.linkedinShareSchedules?.find(
                  (schedule) =>
                    schedule.status === "scheduled" &&
                    schedule.scheduledAt &&
                    new Date(schedule.scheduledAt).getTime() > Date.now()
                );
                const activeLinkedInSchedule =
                  dueLinkedInSchedule || nextLinkedInSchedule;
                const activeLinkedInScheduleId =
                  activeLinkedInSchedule?.jobId || "";
                const isCancelingSchedule =
                  activeLinkedInScheduleId &&
                  cancelingScheduleId === activeLinkedInScheduleId;
                const canShareToLinkedIn =
                  linkedin.connected &&
                  !linkedin.needsReconnect &&
                  post.status === "published";

                return (
                  <article className={styles.postListRow} key={post.id}>
                    <Link
                      className={styles.postListTitleLink}
                      href={editHref}
                    >
                      <strong>{post.title}</strong>
                      <span>{post.slug ? `/${post.slug}` : "No slug yet"}</span>
                    </Link>

                    <span className={styles.statusBadge}>
                      {STATUS_LABELS[post.status] || post.status}
                    </span>

                    <span className={styles.postListCellSecondary}>
                      {formatDate(post.updatedAt || post.publishedAt)}
                    </span>

                    <span className={styles.postListCategories}>
                      {visibleCategories.length > 0 ? (
                        <>
                          {visibleCategories.map((category) => (
                            <span
                              className={styles.postListCategory}
                              key={getCategoryKey(category)}
                            >
                              {category.label}
                            </span>
                          ))}
                          {extraCategoryCount > 0 && (
                            <span className={styles.postListCellSecondary}>
                              +{extraCategoryCount}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className={styles.postListCellSecondary}>None</span>
                      )}
                    </span>

                    <span className={styles.postListActionCell}>
                      <Link
                        className={styles.secondaryButton}
                        href={editHref}
                      >
                        Edit
                      </Link>
                      {post.status === "published" && (
                        <button
                          className={styles.secondaryButton}
                          disabled={
                            !canShareToLinkedIn || sharingPostId === post.id
                          }
                          type="button"
                          onClick={() => openShareDialog(post)}
                        >
                          {sharingPostId === post.id ? "Sharing..." : "Share"}
                        </button>
                      )}
                      {latestLinkedInShare?.sharedAt && (
                        <span className={styles.postListShareMeta}>
                          LinkedIn {formatDate(latestLinkedInShare.sharedAt)}
                        </span>
                      )}
                      {latestLinkedInHistory?.status === "failed" && (
                        <span className={styles.postListShareMeta}>
                          LinkedIn failed{" "}
                          {formatDateTime(
                            getShareHistoryStatusTime(latestLinkedInHistory),
                            latestLinkedInHistory.scheduledTimeZone
                          )}
                        </span>
                      )}
                      {activeLinkedInSchedule?.scheduledAt && (
                        <>
                          <span className={styles.postListShareMeta}>
                            {dueLinkedInSchedule
                              ? "LinkedIn due since"
                              : "Admin scheduled"}{" "}
                            {formatDateTime(
                              activeLinkedInSchedule.scheduledAt,
                              activeLinkedInSchedule.scheduledTimeZone
                            )}
                          </span>
                          <button
                            className={styles.secondaryButton}
                            disabled={
                              Boolean(isCancelingSchedule) ||
                              sharingPostId === post.id
                            }
                            type="button"
                            onClick={() =>
                              openShareDialog(post, activeLinkedInSchedule)
                            }
                          >
                            Edit schedule
                          </button>
                          <button
                            className={styles.dangerButton}
                            disabled={
                              Boolean(isCancelingSchedule) ||
                              sharingPostId === post.id
                            }
                            type="button"
                            onClick={() =>
                              cancelLinkedInSchedule(
                                post,
                                activeLinkedInSchedule
                              )
                            }
                          >
                            {isCancelingSchedule
                              ? "Canceling..."
                              : "Cancel schedule"}
                          </button>
                        </>
                      )}
                    </span>
                  </article>
                );
              })}

              {!isLoading && posts.length === 0 && (
                <p className={styles.postListEmpty}>No posts yet.</p>
              )}
            </div>
          </section>
        </div>
      </main>

      {pendingSharePost && (
        <div
          className={styles.modalBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeShareDialog();
            }
          }}
        >
          <section
            aria-labelledby="linkedin-share-title"
            aria-modal="true"
            className={styles.modalPanel}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <div className={styles.titleBlock}>
                <h2 id="linkedin-share-title">
                  {pendingShareSchedule
                    ? "Edit scheduled LinkedIn share"
                    : "Share to LinkedIn"}
                </h2>
                <p className={styles.muted}>{pendingSharePost.title}</p>
              </div>
              <button
                aria-label="Close LinkedIn share dialog"
                className={styles.iconButton}
                disabled={Boolean(sharingPostId)}
                type="button"
                onClick={closeShareDialog}
              >
                <X aria-hidden="true" size={18} strokeWidth={2.2} />
              </button>
            </div>

            <fieldset className={styles.shareTargetList}>
              <legend>Destination</legend>
              <label className={styles.shareTargetOption}>
                <input
                  checked={shareTarget === "personal_profile"}
                  name="linkedin-share-target"
                  type="radio"
                  value="personal_profile"
                  onChange={(event) => setShareTarget(event.target.value)}
                />
                <span>
                  <strong>Personal profile</strong>
                  <small>
                    {linkedin.profile?.name || linkedin.profile?.email}
                  </small>
                </span>
              </label>

              <label
                className={`${styles.shareTargetOption} ${styles.shareTargetOptionDisabled}`}
              >
                <input
                  disabled
                  name="linkedin-share-target"
                  type="radio"
                  value="company_page"
                />
                <span>
                  <strong>Company page</strong>
                  <small>Requires LinkedIn organization publishing setup.</small>
                </span>
              </label>
            </fieldset>

            <div className={styles.shareComposerGrid}>
              <label className={styles.field}>
                Language
                <select
                  value={shareLanguage}
                  onChange={(event) => setShareLanguage(event.target.value)}
                >
                  {getShareableLanguages(pendingSharePost).map((language) => (
                    <option key={language.code} value={language.code}>
                      {language.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.field}>
                <span>Selected post text</span>
                <div className={styles.sharePreview}>
                  <strong>
                    {getPostTranslation(pendingSharePost, shareLanguage).title ||
                      pendingSharePost.title}
                  </strong>
                  <span>
                    {getPostTranslation(pendingSharePost, shareLanguage).summary ||
                      "No summary saved for this language."}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>Thoughts</span>
                <button
                  className={`${styles.secondaryButton} ${styles.shareThoughtButton}`}
                  disabled={isGeneratingThoughts || Boolean(sharingPostId)}
                  type="button"
                  onClick={() => generateShareThoughts(pendingSharePost)}
                >
                  <Sparkles aria-hidden="true" size={16} strokeWidth={2.2} />
                  {isGeneratingThoughts ? "Generating..." : "Generate"}
                </button>
              </div>
              <textarea
                ref={shareThoughtsRef}
                maxLength={2800}
                placeholder={`Optional note for your ${getSiteLanguageLabel(
                  shareLanguage
                )} LinkedIn post. If empty, the post title and summary are used.`}
                rows={5}
                value={shareCommentary}
                onChange={(event) => setShareCommentary(event.target.value)}
              />
              <div className={styles.shareEmojiRow} aria-label="Emoji shortcuts">
                {SHARE_EMOJIS.map((emoji) => (
                  <button
                    aria-label={`Insert ${emoji}`}
                    className={styles.shareEmojiButton}
                    disabled={Boolean(sharingPostId)}
                    key={emoji}
                    type="button"
                    onClick={() => insertShareEmoji(emoji)}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
              <span className={styles.muted}>
                The blog link is added automatically if it is not included.
              </span>
            </div>

            <fieldset className={styles.shareTargetList}>
              <legend>Media</legend>
              {canIncludeLinkedInImage(pendingSharePost) ? (
                <label className={styles.shareTargetOption}>
                  <input
                    checked={shareIncludeImage}
                    name="linkedin-share-include-image"
                    type="checkbox"
                    onChange={(event) =>
                      setShareIncludeImage(event.target.checked)
                    }
                  />
                  <span>
                    <strong>Include attached image</strong>
                    <small>{getShareImageStatus(pendingSharePost)}</small>
                  </span>
                </label>
              ) : (
                <p className={styles.muted}>
                  {getShareImageStatus(pendingSharePost)}
                </p>
              )}
            </fieldset>

            <fieldset className={styles.shareTargetList}>
              <legend>Timing</legend>
              <label
                className={`${styles.shareTargetOption} ${
                  pendingShareSchedule ? styles.shareTargetOptionDisabled : ""
                }`}
              >
                <input
                  checked={shareTiming === "now"}
                  disabled={Boolean(pendingShareSchedule)}
                  name="linkedin-share-timing"
                  type="radio"
                  value="now"
                  onChange={(event) => setShareTiming(event.target.value)}
                />
                <span>
                  <strong>Share now</strong>
                  <small>Publish immediately after confirmation.</small>
                </span>
              </label>

              <label
                className={`${styles.shareTargetOption} ${
                  !linkedin.schedulerConfigured
                    ? styles.shareTargetOptionDisabled
                    : ""
                }`}
              >
                <input
                  checked={shareTiming === "scheduled"}
                  disabled={!linkedin.schedulerConfigured}
                  name="linkedin-share-timing"
                  type="radio"
                  value="scheduled"
                  onChange={(event) => {
                    setShareTiming(event.target.value);
                    if (!shareScheduledAt) {
                      setShareScheduledAt(
                        toDateTimeLocalValue(
                          Date.now() + 60 * 60 * 1000,
                          shareTimeZone
                        )
                      );
                    }
                  }}
                />
                <span>
                  <strong>Schedule</strong>
                  {linkedin.schedulerConfigured ? (
                    <small>
                      Queue in the backend scheduler. Netlify publishes after
                      the selected time.
                    </small>
                  ) : (
                    <small>
                      Turn on the LinkedIn scheduler in Netlify environment
                      variables to enable scheduled shares.
                    </small>
                  )}
                </span>
              </label>

              {shareTiming === "scheduled" && (
                <div className={styles.shareScheduleGrid}>
                  <label className={styles.field}>
                    Scheduled time
                    <input
                      type="datetime-local"
                      value={shareScheduledAt}
                      onChange={(event) =>
                        setShareScheduledAt(event.target.value)
                      }
                    />
                  </label>
                  <label className={styles.field}>
                    Time zone
                    <select
                      value={shareTimeZone}
                      onChange={(event) => setShareTimeZone(event.target.value)}
                    >
                      {timeZoneOptions.map((timeZone) => (
                        <option key={timeZone} value={timeZone}>
                          {getTimeZoneLabel(timeZone)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p className={`${styles.muted} ${styles.shareScheduleNote}`}>
                    Netlify checks queued shares every minute and publishes due
                    posts at or shortly after the selected time. These backend
                    queued posts do not appear in LinkedIn&apos;s native
                    scheduled posts list.
                  </p>
                </div>
              )}
            </fieldset>

            <section className={styles.shareHistoryPanel}>
              <div className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>Sharing history</span>
                <div className={styles.shareHistoryHeaderActions}>
                  {pendingShareHasDueSchedules && (
                    <button
                      className={styles.secondaryButton}
                      disabled={isRunningScheduler || Boolean(sharingPostId)}
                      type="button"
                      onClick={runDueLinkedInShares}
                    >
                      {isRunningScheduler ? "Running..." : "Run due shares"}
                    </button>
                  )}
                  <span className={styles.muted}>
                    {pendingShareHistory.length} event
                    {pendingShareHistory.length === 1 ? "" : "s"}
                  </span>
                </div>
              </div>

              {pendingShareHistory.length > 0 ? (
                <div className={styles.shareHistoryList}>
                  {pendingShareHistory.map((entry) => {
                    const status = getShareHistoryDisplayStatus(entry);
                    const statusTime = getShareHistoryStatusTime(entry);
                    const statusLabel =
                      SHARE_HISTORY_STATUS_LABELS[status] || status;

                    return (
                      <article className={styles.shareHistoryItem} key={entry.id}>
                        <div className={styles.shareHistoryItemHeader}>
                          <strong>{entry.kind}</strong>
                          <span
                            className={`${styles.shareHistoryStatus} ${getShareHistoryStatusClass(
                              status
                            )}`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <div className={styles.shareHistoryMeta}>
                          <span>
                            {status === "due"
                              ? "Due since"
                              : status === "scheduled"
                              ? "Scheduled for"
                              : status === "processing"
                              ? "Attempted"
                              : status === "failed"
                              ? "Failed"
                              : status === "canceled"
                              ? "Canceled"
                              : "Published"}{" "}
                            {formatDateTime(
                              statusTime,
                              entry.scheduledTimeZone
                            )}
                          </span>
                          {entry.scheduledAt && status !== "scheduled" && (
                            <span>
                              Scheduled for{" "}
                              {formatDateTime(
                                entry.scheduledAt,
                                entry.scheduledTimeZone
                              )}
                            </span>
                          )}
                          {entry.processingStartedAt &&
                            status !== "processing" && (
                              <span>
                                Attempted{" "}
                                {formatDateTime(
                                  entry.processingStartedAt,
                                  entry.scheduledTimeZone
                                )}
                              </span>
                            )}
                          {entry.language && (
                            <span>
                              Language: {getSiteLanguageLabel(entry.language)}
                            </span>
                          )}
                          {entry.account?.email && (
                            <span>Account: {entry.account.email}</span>
                          )}
                        </div>
                        {entry.failure && (
                          <p className={styles.shareHistoryFailure}>
                            {entry.failure}
                          </p>
                        )}
                        {entry.linkedInPostUrl && (
                          <Link
                            className={styles.shareHistoryLink}
                            href={entry.linkedInPostUrl}
                            rel="noreferrer"
                            target="_blank"
                          >
                            Open LinkedIn post
                          </Link>
                        )}
                        {entry.status === "scheduled" && entry.jobId && (
                          <div className={styles.shareHistoryActions}>
                            <button
                              className={styles.secondaryButton}
                              disabled={
                                Boolean(sharingPostId) ||
                                cancelingScheduleId === entry.jobId
                              }
                              type="button"
                              onClick={() =>
                                openShareDialog(pendingSharePost, entry)
                              }
                            >
                              Edit
                            </button>
                            <button
                              className={styles.dangerButton}
                              disabled={
                                Boolean(sharingPostId) ||
                                cancelingScheduleId === entry.jobId
                              }
                              type="button"
                              onClick={() =>
                                cancelLinkedInSchedule(
                                  pendingSharePost,
                                  entry
                                )
                              }
                            >
                              {cancelingScheduleId === entry.jobId
                                ? "Canceling..."
                                : "Cancel"}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className={styles.muted}>
                  No LinkedIn share attempts have been recorded for this post.
                </p>
              )}
            </section>

            <div className={styles.modalFooter}>
              <button
                className={styles.secondaryButton}
                disabled={Boolean(sharingPostId)}
                type="button"
                onClick={closeShareDialog}
              >
                Cancel
              </button>
              <button
                className={styles.button}
                disabled={Boolean(sharingPostId)}
                type="button"
                onClick={() =>
                  sharePostToLinkedIn(pendingSharePost, {
                    commentary: shareCommentary,
                    includeImage: shareIncludeImage,
                    language: shareLanguage,
                    scheduledAt: shareScheduledAt,
                    scheduledJobId: pendingShareSchedule?.jobId || "",
                    target: shareTarget,
                    timeZone: shareTimeZone,
                    timing: shareTiming,
                  })
                }
              >
                {sharingPostId
                  ? shareTiming === "scheduled"
                    ? pendingShareSchedule
                      ? "Saving..."
                      : "Scheduling..."
                    : "Sharing..."
                  : shareTiming === "scheduled"
                  ? pendingShareSchedule
                    ? "Save schedule"
                    : "Schedule"
                  : "Share"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
