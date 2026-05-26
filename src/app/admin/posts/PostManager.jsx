"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {useEffect, useMemo, useRef, useState} from "react";

import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const EMPTY_FORM = {
  id: null,
  title: "",
  slug: "",
  status: "draft",
  summary: "",
  contentHtml: "",
  media: null,
};

const STATUS_LABELS = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const AI_MODES = {
  create: "Create",
  tweak: "Tweak",
  translate: "Translate",
};

const POST_LANGUAGES = [
  {code: "en", label: "English"},
  {code: "de", label: "German"},
];

function sortPosts(posts) {
  return [...posts].sort(
    (left, right) => new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
  );
}

function formatDate(value) {
  if (!value) return "Not published";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function getPostListMeta(post) {
  const date = post.status === "published" ? post.publishedAt : post.updatedAt;
  return `${STATUS_LABELS[post.status] || post.status} · ${formatDate(date)}`;
}

function getAiPromptPlaceholder(mode) {
  if (mode === "create") {
    return "Describe the post you want to create: topic, audience, key points, tone, and any facts that must be included.";
  }

  if (mode === "translate") {
    return "Optional translation guidance, terminology, or tone preferences.";
  }

  return "Describe what should change: make it sharper, shorter, more executive, more technical, more conversational, etc.";
}

export default function PostManager({user}) {
  const editorRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editorKey, setEditorKey] = useState(0);
  const [status, setStatus] = useState({type: "message", text: "Loading posts..."});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiWorking, setIsAiWorking] = useState(false);
  const [aiForm, setAiForm] = useState({
    mode: "tweak",
    targetLanguage: "en",
    prompt: "",
  });

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
        const response = await fetch("/api/admin/posts", {cache: "no-store"});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load posts.");
        }

        if (!cancelled) {
          setPosts(data.posts || []);
          setStatus(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStatus({type: "error", text: error.message});
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
  }, []);

  function loadForm(post) {
    setForm({
      id: post.id || null,
      title: post.title || "",
      slug: post.slug || "",
      status: post.status || "draft",
      summary: post.summary || "",
      contentHtml: post.contentHtml || "",
      media: post.media || null,
    });
    setEditorKey((key) => key + 1);
    setStatus(null);
  }

  function newPost() {
    setForm(EMPTY_FORM);
    setEditorKey((key) => key + 1);
    setStatus(null);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function updateAiField(name, value) {
    setAiForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function readEditorContent() {
    return editorRef.current?.innerHTML || "";
  }

  function applyGeneratedPost(post) {
    setForm((current) => ({
      ...current,
      title: post.title || current.title,
      summary: post.summary || current.summary,
      contentHtml: post.contentHtml || current.contentHtml,
    }));
    setEditorKey((key) => key + 1);
  }

  function runEditorCommand(command, value = null) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
  }

  function insertLink() {
    const url = window.prompt("Link URL");
    if (!url) return;

    runEditorCommand("createLink", url);
  }

  async function uploadFile(event) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setStatus(null);

    try {
      const body = new FormData();
      body.append("file", file);

      const response = await fetch("/api/admin/uploads", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to upload file.");
      }

      updateField("media", data.asset);
      setStatus({type: "success", text: "File uploaded."});
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      input.value = "";
      setIsUploading(false);
    }
  }

  async function runAiAction() {
    setIsAiWorking(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/posts/ai", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          mode: aiForm.mode,
          targetLanguage: aiForm.targetLanguage,
          prompt: aiForm.prompt,
          title: form.title,
          summary: form.summary,
          contentHtml: readEditorContent(),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to generate post content.");
      }

      applyGeneratedPost(data.post);
      setStatus({
        type: "success",
        text: "AI content applied. Review it before saving the post.",
      });
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsAiWorking(false);
    }
  }

  async function savePost(event) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      const contentHtml = readEditorContent();
      const payload = {
        title: form.title,
        status: form.status,
        summary: form.summary,
        contentHtml,
        media: form.media,
      };
      const response = await fetch(
        form.id ? `/api/admin/posts/${form.id}` : "/api/admin/posts",
        {
          method: form.id ? "PUT" : "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to save post.");
      }

      setPosts((current) =>
        sortPosts([data.post, ...current.filter((post) => post.id !== data.post.id)])
      );
      loadForm(data.post);
      setStatus({
        type: "success",
        text: `${data.post.title} saved as ${STATUS_LABELS[data.post.status]}.`,
      });
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSaving(false);
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
              Create portfolio posts with rich text and hosted media.
            </p>
          </div>
        </div>

        <div className={styles.postWorkspace}>
          <aside className={styles.postListPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>All posts</h2>
                <p className={styles.muted}>
                  {counts.draft} drafts · {counts.published} published ·{" "}
                  {counts.archived} archived
                </p>
              </div>
              <button className={styles.button} type="button" onClick={newPost}>
                New post
              </button>
            </div>

            <div className={styles.postList}>
              {posts.map((post) => (
                <button
                  className={`${styles.postListItem} ${
                    form.id === post.id ? styles.postListItemActive : ""
                  }`}
                  key={post.id}
                  type="button"
                  onClick={() => loadForm(post)}
                >
                  <strong>{post.title}</strong>
                  <span>{getPostListMeta(post)}</span>
                </button>
              ))}

              {!isLoading && posts.length === 0 && (
                <p className={styles.muted}>No posts yet.</p>
              )}
            </div>
          </aside>

          <form className={styles.postEditorPanel} onSubmit={savePost}>
            <div className={styles.editorTitleRow}>
              <div className={styles.titleBlock}>
                <h2>{form.id ? "Edit post" : "Create post"}</h2>
                {form.slug && (
                  <p className={styles.muted}>
                    Slug: {form.slug}
                    {form.status === "published" && (
                      <>
                        {" "}
                        ·{" "}
                        <Link href={`/blog/${form.slug}`} target="_blank">
                          View published post
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
              <button className={styles.button} disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save post"}
              </button>
            </div>

            <div className={styles.formGrid}>
              <label className={styles.field}>
                Title
                <input
                  required
                  maxLength={140}
                  value={form.title}
                  onChange={(event) => updateField("title", event.target.value)}
                />
              </label>

              <label className={styles.field}>
                Status
                <select
                  value={form.status}
                  onChange={(event) => updateField("status", event.target.value)}
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
            </div>

            <label className={styles.field}>
              Summary
              <textarea
                rows={3}
                maxLength={260}
                placeholder="Optional short card text. If empty, it is generated from the post content."
                value={form.summary}
                onChange={(event) => updateField("summary", event.target.value)}
              />
            </label>

            <section className={styles.aiPanel}>
              <div className={styles.editorTitleRow}>
                <div className={styles.titleBlock}>
                  <h2>AI assistant</h2>
                  <p className={styles.muted}>
                    Create, improve, or translate the current post draft.
                  </p>
                </div>
                <button
                  className={styles.button}
                  disabled={isAiWorking}
                  type="button"
                  onClick={runAiAction}
                >
                  {isAiWorking ? "Working..." : "Run AI"}
                </button>
              </div>

              <div className={styles.aiGrid}>
                <label className={styles.field}>
                  Action
                  <select
                    value={aiForm.mode}
                    onChange={(event) => updateAiField("mode", event.target.value)}
                  >
                    {Object.entries(AI_MODES).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  Language
                  <select
                    value={aiForm.targetLanguage}
                    onChange={(event) =>
                      updateAiField("targetLanguage", event.target.value)
                    }
                  >
                    {POST_LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className={styles.field}>
                Prompt
                <textarea
                  rows={4}
                  placeholder={getAiPromptPlaceholder(aiForm.mode)}
                  value={aiForm.prompt}
                  onChange={(event) => updateAiField("prompt", event.target.value)}
                />
              </label>
            </section>

            <section className={styles.mediaPanel}>
              <div className={styles.editorTitleRow}>
                <div className={styles.titleBlock}>
                  <h2>Media</h2>
                  <p className={styles.muted}>Attach one image or video to the post.</p>
                </div>
                <label className={styles.uploadButton}>
                  {isUploading ? "Uploading..." : "Upload file"}
                  <input
                    accept="image/*,video/*"
                    disabled={isUploading}
                    type="file"
                    onChange={uploadFile}
                  />
                </label>
              </div>

              {form.media ? (
                <div className={styles.mediaPreview}>
                  {form.media.type === "image" ? (
                    <img src={form.media.url} alt="" />
                  ) : (
                    <video controls src={form.media.url} />
                  )}
                  <div className={styles.mediaDetails}>
                    <strong title={form.media.fileName || "Uploaded media"}>
                      {form.media.fileName || "Uploaded media"}
                    </strong>
                    <span>{form.media.mimeType || form.media.type}</span>
                    <button
                      className={styles.dangerButton}
                      type="button"
                      onClick={() => updateField("media", null)}
                    >
                      Remove media
                    </button>
                  </div>
                </div>
              ) : (
                <p className={styles.muted}>No media attached.</p>
              )}
            </section>

            <section className={styles.richTextPanel}>
              <div className={styles.richTextToolbar} aria-label="Rich text toolbar">
                <button type="button" onClick={() => runEditorCommand("bold")}>
                  B
                </button>
                <button type="button" onClick={() => runEditorCommand("italic")}>
                  I
                </button>
                <button type="button" onClick={() => runEditorCommand("underline")}>
                  U
                </button>
                <button type="button" onClick={() => runEditorCommand("formatBlock", "h2")}>
                  H2
                </button>
                <button type="button" onClick={() => runEditorCommand("formatBlock", "p")}>
                  P
                </button>
                <button
                  type="button"
                  onClick={() => runEditorCommand("insertUnorderedList")}
                >
                  List
                </button>
                <button
                  type="button"
                  onClick={() => runEditorCommand("insertOrderedList")}
                >
                  1.
                </button>
                <button type="button" onClick={insertLink}>
                  Link
                </button>
              </div>

              <div
                aria-label="Post content"
                className={styles.richEditor}
                contentEditable
                dangerouslySetInnerHTML={{__html: form.contentHtml}}
                dir="ltr"
                key={editorKey}
                ref={editorRef}
                role="textbox"
                spellCheck="true"
                suppressContentEditableWarning
              />
            </section>

            {status && <p className={styles[status.type]}>{status.text}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
