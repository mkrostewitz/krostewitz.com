"use client";

import Link from "next/link";
import {useEffect, useMemo, useState} from "react";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
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

export default function PostManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

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
    </div>
  );
}
