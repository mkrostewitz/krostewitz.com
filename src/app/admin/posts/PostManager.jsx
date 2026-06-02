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
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnectingLinkedin, setIsDisconnectingLinkedin] = useState(false);
  const [sharingPostId, setSharingPostId] = useState("");
  const [pendingSharePost, setPendingSharePost] = useState(null);
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
        const [postsResponse, linkedinResponse] = await Promise.all([
          fetch("/api/admin/posts", {cache: "no-store"}),
          fetch("/api/admin/linkedin", {cache: "no-store"}),
        ]);
        const postsData = await postsResponse.json().catch(() => ({}));
        const linkedinData = await linkedinResponse.json().catch(() => ({}));

        if (!postsResponse.ok) {
          throw new Error(postsData.error || "Unable to load posts.");
        }

        if (!cancelled) {
          setPosts(postsData.posts || []);
          if (linkedinResponse.ok) {
            setLinkedin((current) => ({
              ...current,
              ...(linkedinData.integration || {}),
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

  function openShareDialog(post) {
    setShareTarget("personal_profile");
    setShareLanguage(getDefaultShareLanguage(post));
    setShareCommentary("");
    setShareIncludeImage(canIncludeLinkedInImage(post));
    setShareTiming("now");
    setShareScheduledAt("");
    setShareTimeZone(getDefaultTimeZone());
    setPendingSharePost(post);
  }

  function closeShareDialog() {
    if (sharingPostId || isGeneratingThoughts) return;
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
          scheduledTimeZone: options.timeZone,
          target: options.target,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
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
              message: `LinkedIn share queued for ${formatDateTime(
                data.linkedin?.scheduledAt,
                data.linkedin?.scheduledTimeZone || options.timeZone
              )}. Netlify checks due shares every minute.`,
            }
          : {
              type: "success",
              message: "Post shared to LinkedIn.",
            }
      );
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
              <span className={styles.statusBadge}>
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
              </div>

              <div className={styles.buttonRow}>
                {linkedin.available && (
                  <a
                    className={styles.secondaryButton}
                    href="/api/admin/linkedin/connect"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {linkedin.connected ? "Reconnect" : "Connect LinkedIn"}
                  </a>
                )}
                {linkedin.connected && (
                  <button
                    className={styles.ghostButton}
                    disabled={isDisconnectingLinkedin}
                    type="button"
                    onClick={disconnectLinkedIn}
                  >
                    {isDisconnectingLinkedin ? "Disconnecting..." : "Disconnect"}
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
                const nextLinkedInSchedule = post.linkedinShareSchedules?.find(
                  (schedule) =>
                    schedule.status === "scheduled" &&
                    schedule.scheduledAt &&
                    new Date(schedule.scheduledAt).getTime() > Date.now()
                );
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
                      {nextLinkedInSchedule?.scheduledAt && (
                        <span className={styles.postListShareMeta}>
                          Admin scheduled{" "}
                          {formatDateTime(
                            nextLinkedInSchedule.scheduledAt,
                            nextLinkedInSchedule.scheduledTimeZone
                          )}
                        </span>
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
                <h2 id="linkedin-share-title">Share to LinkedIn</h2>
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
              <label className={styles.shareTargetOption}>
                <input
                  checked={shareTiming === "now"}
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
                    target: shareTarget,
                    timeZone: shareTimeZone,
                    timing: shareTiming,
                  })
                }
              >
                {sharingPostId
                  ? shareTiming === "scheduled"
                    ? "Scheduling..."
                    : "Sharing..."
                  : shareTiming === "scheduled"
                  ? "Schedule"
                  : "Share"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
