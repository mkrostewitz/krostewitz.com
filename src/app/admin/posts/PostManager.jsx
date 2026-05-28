"use client";

/* eslint-disable @next/next/no-img-element */

import {EditorContent, useEditor} from "@tiptap/react";
import LinkExtension from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";
import UnderlineExtension from "@tiptap/extension-underline";
import {
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Heading4,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
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
  categories: [],
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

const SUGGESTED_CATEGORIES = [
  "Market data",
  "Marketing",
  "Operations",
  "Systems",
  "Cooking",
  "Sailing",
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

function cleanCategoryLabel(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 50);
}

function slugCategoryLabel(value) {
  return cleanCategoryLabel(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getCategoryKey(category) {
  const label = cleanCategoryLabel(category?.label || "");
  return category?.slug || slugCategoryLabel(label) || label.toLowerCase();
}

function normalizeFormCategories(value) {
  const categories = [];
  const seen = new Set();

  for (const item of Array.isArray(value) ? value : []) {
    const label = cleanCategoryLabel(item?.label || item?.name || item);
    const slug = slugCategoryLabel(item?.slug || label);
    const key = slug || label.toLowerCase();

    if (!label || seen.has(key)) continue;

    categories.push({label, slug});
    seen.add(key);
  }

  return categories;
}

function getAiPromptPlaceholder(mode) {
  if (mode === "create") {
    return "Describe the post you want to create: professional topic, sailing note, cooking idea, audience, key points, tone, and any facts that must be included.";
  }

  if (mode === "translate") {
    return "Optional translation guidance, terminology, or tone preferences.";
  }

  return "Describe what should change: make it sharper, shorter, more executive, more technical, more conversational, etc.";
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

function getPlainTextGroups(value) {
  const normalized = String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .trim();

  if (!normalized) return [];

  return normalized
    .split(/\n{2,}/)
    .map((group) =>
      group
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
    )
    .filter((group) => group.length > 0);
}

function isLikelyHeadingGroup(group) {
  if (!Array.isArray(group) || group.length !== 1) return false;

  const text = group[0];
  return text.length <= 90 && /[a-z0-9]/i.test(text) && !/[.!?,:;]$/.test(text);
}

function isNumberedHeadingGroup(group) {
  return (
    Array.isArray(group) &&
    group.length === 1 &&
    group[0].length <= 110 &&
    /^\d+[.)]\s+\S/.test(group[0])
  );
}

function getUnorderedListItem(line) {
  const match = String(line || "").match(/^([-*+]|\u2022)\s+(.+)$/);
  return match ? match[2] : null;
}

function getOrderedListItem(line) {
  const match = String(line || "").match(/^\d+[.)]\s+(.+)$/);
  return match ? match[1] : null;
}

function renderList(tagName, items) {
  return `<${tagName}>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</${tagName}>`;
}

function renderParagraph(lines) {
  return `<p>${lines.map(escapeHtml).join("<br>")}</p>`;
}

function textGroupEndsWithColon(group) {
  return String(group?.join(" ") || "").trim().endsWith(":");
}

function isImplicitListGroup(group, previousGroup) {
  return (
    Array.isArray(group) &&
    group.length >= 2 &&
    textGroupEndsWithColon(previousGroup) &&
    group.every((line) => line.length <= 160)
  );
}

function plainTextToArticleHtml(value, options = {}) {
  const groups = getPlainTextGroups(value);
  if (groups.length === 0) return {html: "", title: ""};

  let startIndex = 0;
  let title = "";

  if (options.extractTitle && isLikelyHeadingGroup(groups[0])) {
    title = groups[0][0];
    startIndex = 1;
  }

  const blocks = [];
  let previousGroup = null;

  for (let index = startIndex; index < groups.length; index += 1) {
    const group = groups[index];
    const unorderedItems = group.map(getUnorderedListItem);
    const orderedItems = group.map(getOrderedListItem);

    if (unorderedItems.every(Boolean)) {
      blocks.push(renderList("ul", unorderedItems));
    } else if (group.length > 1 && orderedItems.every(Boolean)) {
      blocks.push(renderList("ol", orderedItems));
    } else if (isImplicitListGroup(group, previousGroup)) {
      blocks.push(renderList("ul", group));
    } else if (isNumberedHeadingGroup(group)) {
      blocks.push(`<h3>${escapeHtml(group[0])}</h3>`);
    } else if (isLikelyHeadingGroup(group)) {
      blocks.push(`<h2>${escapeHtml(group[0])}</h2>`);
    } else {
      blocks.push(renderParagraph(group));
    }

    previousGroup = group;
  }

  return {html: blocks.join(""), title};
}

function ToolbarButton({
  active = false,
  children,
  disabled = false,
  icon: Icon,
  label,
  onClick,
}) {
  return (
    <button
      aria-label={label}
      aria-pressed={active || undefined}
      className={[styles.richTextButton, active ? styles.richTextButtonActive : ""]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      title={label}
      type="button"
      onClick={onClick}
    >
      {Icon && <Icon aria-hidden="true" size={18} strokeWidth={2.2} />}
      {children}
    </button>
  );
}

export default function PostManager({user}) {
  const titleRef = useRef("");
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [categoryDraft, setCategoryDraft] = useState("");
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
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
      }),
      UnderlineExtension,
      LinkExtension.configure({
        autolink: true,
        defaultProtocol: "https",
        openOnClick: false,
        HTMLAttributes: {
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
    ],
    content: form.contentHtml || "",
    editorProps: {
      handlePaste: (view, event) => {
        const clipboard = event.clipboardData;
        const text = clipboard?.getData("text/plain");
        const html = clipboard?.getData("text/html");
        const editorIsEmpty = !editor?.getText().trim();
        const hasStructuredPlainText = getPlainTextGroups(text).length >= 3;
        const shouldFormatPlainText =
          !html || event.shiftKey || (editorIsEmpty && hasStructuredPlainText);

        if (!text || clipboard?.files?.length > 0 || !shouldFormatPlainText) {
          return false;
        }

        const parsed = plainTextToArticleHtml(text, {
          extractTitle: !titleRef.current.trim() && editorIsEmpty,
        });

        if (!parsed.html) return false;

        event.preventDefault();

        if (parsed.title) {
          setForm((current) =>
            current.title.trim() ? current : {...current, title: parsed.title}
          );
        }

        editor?.chain().focus().insertContent(parsed.html).run();
        return true;
      },
    },
    immediatelyRender: false,
    onUpdate: ({editor: activeEditor}) => {
      const contentHtml = activeEditor.isEmpty ? "" : activeEditor.getHTML();
      setForm((current) =>
        current.contentHtml === contentHtml
          ? current
          : {...current, contentHtml}
      );
    },
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

  useEffect(() => {
    titleRef.current = form.title;
  }, [form.title]);

  useEffect(() => {
    if (!editor) return;

    const editorHtml = editor.isEmpty ? "" : editor.getHTML();
    const formHtml = form.contentHtml || "";

    if (editorHtml !== formHtml) {
      editor.commands.setContent(formHtml, {emitUpdate: false});
    }
  }, [editor, form.contentHtml]);

  function loadForm(post) {
    setForm({
      id: post.id || null,
      title: post.title || "",
      slug: post.slug || "",
      status: post.status || "draft",
      summary: post.summary || "",
      categories: normalizeFormCategories(post.categories),
      contentHtml: post.contentHtml || "",
      media: post.media || null,
    });
    setCategoryDraft("");
    setStatus(null);
  }

  function newPost() {
    setForm(EMPTY_FORM);
    setCategoryDraft("");
    setStatus(null);
  }

  function updateField(name, value) {
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function addCategory(value = categoryDraft) {
    const label = cleanCategoryLabel(value);
    const key = slugCategoryLabel(label) || label.toLowerCase();

    if (!label) return;

    setForm((current) => {
      const categories = normalizeFormCategories(current.categories);

      if (categories.some((category) => getCategoryKey(category) === key)) {
        return current;
      }

      return {
        ...current,
        categories: [...categories, {label, slug: ""}],
      };
    });
    setCategoryDraft("");
  }

  function removeCategory(key) {
    setForm((current) => ({
      ...current,
      categories: normalizeFormCategories(current.categories).filter(
        (category) => getCategoryKey(category) !== key
      ),
    }));
  }

  function handleCategoryKeyDown(event) {
    if (event.key !== "Enter" && event.key !== ",") return;

    event.preventDefault();
    addCategory();
  }

  function updateAiField(name, value) {
    setAiForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function readEditorContent() {
    if (!editor) return form.contentHtml || "";
    return editor.isEmpty ? "" : editor.getHTML();
  }

  function applyGeneratedPost(post) {
    setForm((current) => ({
      ...current,
      title: post.title || current.title,
      summary: post.summary || current.summary,
      contentHtml: post.contentHtml || current.contentHtml,
    }));
  }

  function setEditorLink() {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href || "";
    const url = window.prompt("Link URL", previousUrl);

    if (url === null) return;

    if (!url.trim()) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor.chain().focus().extendMarkRange("link").setLink({href: url}).run();
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
        categories: form.categories,
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

  const formCategories = normalizeFormCategories(form.categories);

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
          <aside className={styles.postListPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>All posts</h2>
                <p className={styles.muted}>
                  {counts.draft} drafts · {counts.published} published ·{" "}
                  {counts.archived} archived
                </p>
              </div>
              <button
                className={styles.secondaryButton}
                type="button"
                onClick={newPost}
              >
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

            <div className={styles.field}>
              <label htmlFor="post-categories">Categories</label>
              <div className={styles.categoryEditor}>
                <div className={styles.categoryInputRow}>
                  <input
                    id="post-categories"
                    placeholder="Add a category, for example Market data"
                    value={categoryDraft}
                    onChange={(event) => setCategoryDraft(event.target.value)}
                    onKeyDown={handleCategoryKeyDown}
                  />
                  <button
                    className={styles.secondaryButton}
                    type="button"
                    onClick={() => addCategory()}
                  >
                    Add category
                  </button>
                </div>

                <div
                  className={styles.categorySuggestions}
                  aria-label="Suggested categories"
                >
                  {SUGGESTED_CATEGORIES.map((category) => {
                    const isSelected = formCategories.some(
                      (item) => getCategoryKey(item) === slugCategoryLabel(category)
                    );

                    return (
                      <button
                        className={styles.categorySuggestion}
                        disabled={isSelected}
                        key={category}
                        type="button"
                        onClick={() => addCategory(category)}
                      >
                        {category}
                      </button>
                    );
                  })}
                </div>

                {formCategories.length > 0 && (
                  <div className={styles.categoryChips}>
                    {formCategories.map((category) => (
                      <span
                        className={styles.categoryChip}
                        key={getCategoryKey(category)}
                      >
                        {category.label}
                        <button
                          aria-label={`Remove ${category.label}`}
                          type="button"
                          onClick={() => removeCategory(getCategoryKey(category))}
                        >
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <p className={styles.muted}>
                  Use categories for public filtering, for example market data,
                  marketing, cooking, or sailing.
                </p>
              </div>
            </div>

            <section className={styles.aiPanel}>
              <div className={styles.editorTitleRow}>
                <div className={styles.titleBlock}>
                  <h2>AI assistant</h2>
                  <p className={styles.muted}>
                    Create, improve, or translate the current post draft using{" "}
                    <Link href="/admin/ai-settings">AI settings</Link>.
                  </p>
                </div>
                <button
                  className={styles.secondaryButton}
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
              <div className={styles.editorTitleRow}>
                <div className={styles.titleBlock}>
                  <h2>Content</h2>
                  <p className={styles.muted}>Write and format the post body.</p>
                </div>
              </div>

              <div className={styles.richTextToolbar} aria-label="Rich text toolbar">
                <div className={styles.richTextToolbarGroup}>
                  <ToolbarButton
                    disabled={!editor}
                    icon={Undo2}
                    label="Undo"
                    onClick={() => editor?.chain().focus().undo().run()}
                  />
                  <ToolbarButton
                    disabled={!editor}
                    icon={Redo2}
                    label="Redo"
                    onClick={() => editor?.chain().focus().redo().run()}
                  />
                </div>

                <div className={styles.richTextToolbarGroup}>
                  <ToolbarButton
                    active={editor?.isActive("paragraph")}
                    disabled={!editor}
                    icon={Pilcrow}
                    label="Paragraph"
                    onClick={() => editor?.chain().focus().setParagraph().run()}
                  />
                  <ToolbarButton
                    active={editor?.isActive("heading", {level: 2})}
                    disabled={!editor}
                    icon={Heading2}
                    label="Heading 2"
                    onClick={() =>
                      editor?.chain().focus().toggleHeading({level: 2}).run()
                    }
                  />
                  <ToolbarButton
                    active={editor?.isActive("heading", {level: 3})}
                    disabled={!editor}
                    icon={Heading3}
                    label="Heading 3"
                    onClick={() =>
                      editor?.chain().focus().toggleHeading({level: 3}).run()
                    }
                  />
                  <ToolbarButton
                    active={editor?.isActive("heading", {level: 4})}
                    disabled={!editor}
                    icon={Heading4}
                    label="Heading 4"
                    onClick={() =>
                      editor?.chain().focus().toggleHeading({level: 4}).run()
                    }
                  />
                  <ToolbarButton
                    active={editor?.isActive("blockquote")}
                    disabled={!editor}
                    icon={Quote}
                    label="Quote"
                    onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                  />
                </div>

                <div className={styles.richTextToolbarGroup}>
                  <ToolbarButton
                    active={editor?.isActive("bold")}
                    disabled={!editor}
                    icon={Bold}
                    label="Bold"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                  />
                  <ToolbarButton
                    active={editor?.isActive("italic")}
                    disabled={!editor}
                    icon={Italic}
                    label="Italic"
                    onClick={() => editor?.chain().focus().toggleItalic().run()}
                  />
                  <ToolbarButton
                    active={editor?.isActive("underline")}
                    disabled={!editor}
                    icon={Underline}
                    label="Underline"
                    onClick={() => editor?.chain().focus().toggleUnderline().run()}
                  />
                  <ToolbarButton
                    active={editor?.isActive("strike")}
                    disabled={!editor}
                    icon={Strikethrough}
                    label="Strikethrough"
                    onClick={() => editor?.chain().focus().toggleStrike().run()}
                  />
                </div>

                <div className={styles.richTextToolbarGroup}>
                  <ToolbarButton
                    active={editor?.isActive("bulletList")}
                    disabled={!editor}
                    icon={List}
                    label="Bulleted list"
                    onClick={() => editor?.chain().focus().toggleBulletList().run()}
                  />
                  <ToolbarButton
                    active={editor?.isActive("orderedList")}
                    disabled={!editor}
                    icon={ListOrdered}
                    label="Numbered list"
                    onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                  />
                  <ToolbarButton
                    disabled={!editor}
                    icon={IndentDecrease}
                    label="Outdent list item"
                    onClick={() => editor?.chain().focus().liftListItem("listItem").run()}
                  />
                  <ToolbarButton
                    disabled={!editor}
                    icon={IndentIncrease}
                    label="Indent list item"
                    onClick={() => editor?.chain().focus().sinkListItem("listItem").run()}
                  />
                </div>

                <div className={styles.richTextToolbarGroup}>
                  <ToolbarButton
                    active={editor?.isActive("link")}
                    disabled={!editor}
                    icon={LinkIcon}
                    label="Add or edit link"
                    onClick={setEditorLink}
                  />
                  <ToolbarButton
                    disabled={!editor}
                    icon={Unlink}
                    label="Remove link"
                    onClick={() =>
                      editor?.chain().focus().extendMarkRange("link").unsetLink().run()
                    }
                  />
                  <ToolbarButton
                    disabled={!editor}
                    icon={Minus}
                    label="Horizontal rule"
                    onClick={() => editor?.chain().focus().setHorizontalRule().run()}
                  />
                  <ToolbarButton
                    disabled={!editor}
                    icon={Eraser}
                    label="Clear formatting"
                    onClick={() =>
                      editor?.chain().focus().unsetAllMarks().clearNodes().run()
                    }
                  />
                </div>
              </div>

              <EditorContent
                aria-label="Post content"
                className={styles.richEditor}
                editor={editor}
              />
            </section>

            {status && <p className={styles[status.type]}>{status.text}</p>}
          </form>
        </div>
      </main>
    </div>
  );
}
