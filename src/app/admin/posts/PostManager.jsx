"use client";

import {X} from "lucide-react";
import Link from "next/link";
import {useEffect, useMemo, useState} from "react";

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

function formatDate(value) {
  if (!value) return "Not saved";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "Not scheduled";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
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

function toDateTimeLocalValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function toIsoDateTimeValue(value) {
  if (!value) return "";

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export default function PostManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [posts, setPosts] = useState([]);
  const [linkedin, setLinkedin] = useState({
    available: false,
    connected: false,
    needsReconnect: false,
    profile: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnectingLinkedin, setIsDisconnectingLinkedin] = useState(false);
  const [sharingPostId, setSharingPostId] = useState("");
  const [pendingSharePost, setPendingSharePost] = useState(null);
  const [shareTarget, setShareTarget] = useState("personal_profile");
  const [shareLanguage, setShareLanguage] = useState(FALLBACK_LANGUAGE);
  const [shareCommentary, setShareCommentary] = useState("");
  const [shareTiming, setShareTiming] = useState("now");
  const [shareScheduledAt, setShareScheduledAt] = useState("");

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
    setShareTiming("now");
    setShareScheduledAt("");
    setPendingSharePost(post);
  }

  function closeShareDialog() {
    if (sharingPostId) return;
    setPendingSharePost(null);
  }

  async function sharePostToLinkedIn(post, options = {}) {
    if (!linkedin.connected || linkedin.needsReconnect) {
      showSnackbar({
        type: "error",
        message: "Connect LinkedIn before sharing posts.",
      });
      return;
    }

    const scheduledAt =
      options.timing === "scheduled"
        ? toIsoDateTimeValue(options.scheduledAt)
        : "";

    if (options.timing === "scheduled" && !scheduledAt) {
      showSnackbar({type: "error", message: "Choose a valid schedule time."});
      return;
    }

    setSharingPostId(post.id);
    closeSnackbar();

    try {
      const response = await fetch(`/api/admin/posts/${post.id}/linkedin`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          commentary: options.commentary,
          language: options.language,
          scheduledAt,
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
              message: `LinkedIn share scheduled for ${formatDateTime(
                data.linkedin?.scheduledAt
              )}.`,
            }
          : {
              type: "success",
              message: "Post shared to LinkedIn.",
            }
      );
      setPendingSharePost(null);
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
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
                          Scheduled {formatDateTime(nextLinkedInSchedule.scheduledAt)}
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

            <label className={styles.field}>
              Thoughts
              <textarea
                maxLength={2800}
                placeholder={`Optional note for your ${getSiteLanguageLabel(
                  shareLanguage
                )} LinkedIn post. If empty, the post title and summary are used.`}
                rows={5}
                value={shareCommentary}
                onChange={(event) => setShareCommentary(event.target.value)}
              />
              <span className={styles.muted}>
                The blog link is added automatically if it is not included.
              </span>
            </label>

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

              <label className={styles.shareTargetOption}>
                <input
                  checked={shareTiming === "scheduled"}
                  name="linkedin-share-timing"
                  type="radio"
                  value="scheduled"
                  onChange={(event) => {
                    setShareTiming(event.target.value);
                    if (!shareScheduledAt) {
                      setShareScheduledAt(
                        toDateTimeLocalValue(Date.now() + 60 * 60 * 1000)
                      );
                    }
                  }}
                />
                <span>
                  <strong>Schedule</strong>
                  <small>Publish during the next scheduler run after this time.</small>
                </span>
              </label>

              {shareTiming === "scheduled" && (
                <label className={styles.field}>
                  Scheduled time
                  <input
                    type="datetime-local"
                    value={shareScheduledAt}
                    onChange={(event) => setShareScheduledAt(event.target.value)}
                  />
                </label>
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
                    language: shareLanguage,
                    scheduledAt: shareScheduledAt,
                    target: shareTarget,
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
