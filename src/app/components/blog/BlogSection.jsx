"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import BlogCarousel from "./BlogCarousel";
import {loadRuntimeTranslations} from "../../../lib/i18n";
import NewsletterSignup from "../newsletter/NewsletterSignup";
import {useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";

import {getSupportedSiteLanguage} from "../../../lib/siteLanguages";
import pageStyles from "../../page.module.css";
import styles from "./blog-section.module.css";

const ALL_CATEGORIES = "all";
const BLOG_SKELETON_ITEMS = Array.from({length: 3}, (_, index) => index);

function formatDate(value, language) {
  if (!value) return "";

  return new Intl.DateTimeFormat(language || "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function normalizeCategories(value) {
  const categories = [];
  const seen = new Set();

  for (const item of Array.isArray(value) ? value : []) {
    const label = String(item?.label || item || "").trim();
    const slug = String(item?.slug || label)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    if (!label || !slug || seen.has(slug)) continue;

    categories.push({
      label,
      slug,
      count: Number(item?.count) || 0,
    });
    seen.add(slug);
  }

  return categories;
}

function getPreviewMedia(post) {
  if (post?.media?.url) return post.media;

  const galleryImage = Array.isArray(post?.mediaGallery)
    ? post.mediaGallery.find((item) => item?.type === "image" && item.url)
    : null;

  return galleryImage || null;
}

function BlogCardSkeleton() {
  return (
    <article className={styles.skeletonCard} aria-hidden="true">
      <div className={`${styles.media} ${styles.skeletonMedia}`} />
      <div className={styles.skeletonBody}>
        <span className={`${styles.skeletonLine} ${styles.skeletonDate}`} />
        <div className={styles.skeletonCategories}>
          <span />
          <span />
        </div>
        <span className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
        <span className={styles.skeletonLine} />
        <span className={`${styles.skeletonLine} ${styles.skeletonSummary}`} />
        <span className={`${styles.skeletonLine} ${styles.skeletonAction}`} />
      </div>
    </article>
  );
}

export default function BlogSection({archive = false}) {
  const {t, i18n} = useTranslation();
  const [query, setQuery] = useState("");
  const Heading = archive ? "h1" : "h2";
  const language =
    getSupportedSiteLanguage(i18n.resolvedLanguage || i18n.language) || "en";
  const [posts, setPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORIES);
  const [blogEnabled, setBlogEnabled] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const availableCategories = useMemo(() => {
    const bySlug = new Map();

    for (const category of normalizeCategories(categories)) {
      bySlug.set(category.slug, category);
    }

    for (const post of posts) {
      for (const category of normalizeCategories(post.categories)) {
        if (!bySlug.has(category.slug)) {
          bySlug.set(category.slug, category);
        }
      }
    }

    return [...bySlug.values()].sort((left, right) =>
      left.label.localeCompare(right.label, i18n.language)
    );
  }, [categories, posts, i18n.language]);

  const visiblePosts = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase(language).split(/\s+/).filter(Boolean);
    return posts.filter((post) => {
      const tags = normalizeCategories(post.categories);
      const matchesCategory = activeCategory === ALL_CATEGORIES || tags.some(
        (category) => category.slug === activeCategory
      );
      const text = [post.title, post.summary, ...tags.map((tag) => tag.label)]
        .join(" ").toLocaleLowerCase(language);
      return matchesCategory && terms.every((term) => text.includes(term));
    });
  }, [activeCategory, posts, query, language]);

  useEffect(() => {
    void loadRuntimeTranslations();
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      setIsLoading(true);
      try {
        const searchParams = new URLSearchParams({language});
        const response = await fetch(`/api/posts?${searchParams.toString()}`, {
          cache: "no-store",
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load posts.");
        }

        if (!cancelled) {
          setBlogEnabled(data.blogEnabled !== false);
          setPosts(data.posts || []);
          setCategories(data.categories || []);
        }
      } catch {
        if (!cancelled) {
          setBlogEnabled(false);
          setPosts([]);
          setCategories([]);
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
  }, [language]);

  useEffect(() => {
    if (
      activeCategory !== ALL_CATEGORIES &&
      !availableCategories.some((category) => category.slug === activeCategory)
    ) {
      setActiveCategory(ALL_CATEGORIES);
    }
  }, [activeCategory, availableCategories]);

  if (blogEnabled === false && !archive) return null;

  const PostLayout = archive ? "div" : BlogCarousel;

  return (
    <section
      id="blog"
      className={`${pageStyles.section} ${styles.section}`}
      aria-busy={isLoading}
    >
      <div className={styles.sectionHeader}>
        <span className={pageStyles.eyebrow}>{t("blog.eyebrow")}</span>
        <Heading>{t(archive ? "blog.archiveTitle" : "blog.title")}</Heading>
        <p>{t("blog.subtitle")}</p>

        {archive && (
          <label className={styles.searchLabel}>
            {t("blog.searchLabel")}
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder={t("blog.searchPlaceholder")} className={styles.searchInput} />
          </label>
        )}
        {!archive && <Link className={pageStyles.secondary} href={`/blog?lng=${language}`}>
          {t("blog.seeAll")}
        </Link>}
        {archive && !isLoading && availableCategories.length > 0 ? (
          <div className={styles.filterList} aria-label={t("blog.filterLabel")}>
            <button
              className={`${styles.filterButton} ${
                activeCategory === ALL_CATEGORIES ? styles.filterButtonActive : ""
              }`}
              type="button"
              aria-pressed={activeCategory === ALL_CATEGORIES}
              onClick={() => setActiveCategory(ALL_CATEGORIES)}
            >
              {t("blog.filterAll")}
            </button>
            {availableCategories.map((category) => (
              <button
                className={`${styles.filterButton} ${
                  activeCategory === category.slug ? styles.filterButtonActive : ""
                }`}
                key={category.slug}
                type="button"
                aria-pressed={activeCategory === category.slug}
                onClick={() => setActiveCategory(category.slug)}
              >
                {category.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {archive && !isLoading && <p className={styles.resultCount} role="status">
        {t("blog.resultCount", {count: visiblePosts.length})}
        {(query || activeCategory !== ALL_CATEGORIES) && <button type="button"
          className={styles.filterButton} onClick={() => {setQuery(""); setActiveCategory(ALL_CATEGORIES);}}>
          {t("blog.clearFilters")}
        </button>}
      </p>}
      {isLoading ? (
        <div
          className={styles.grid}
          role="status"
          aria-label={t("blog.loading", {defaultValue: "Loading posts..."})}
        >
          {BLOG_SKELETON_ITEMS.map((item) => (
            <BlogCardSkeleton key={item} />
          ))}
        </div>
      ) : visiblePosts.length > 0 ? (
        <PostLayout className={styles.grid}>
          {visiblePosts.map((post) => {
            const previewMedia = getPreviewMedia(post);

            return (
              <Link
                className={styles.card}
                href={`/blog/${post.slug}?lng=${language}`}
                key={post.id}
              >
                {previewMedia && (
                  <div className={styles.media}>
                    {previewMedia.type === "image" ? (
                      <img src={previewMedia.url} alt="" loading="lazy" />
                    ) : (
                      <video
                        muted
                        playsInline
                        preload="metadata"
                        src={previewMedia.url}
                      />
                    )}
                  </div>
                )}

                <div className={styles.cardBody}>
                  <span className={styles.date}>
                    {formatDate(
                      post.publishedAt || post.updatedAt,
                      i18n.language
                    )}
                  </span>
                  {normalizeCategories(post.categories).length > 0 && (
                    <div className={styles.cardCategories}>
                      {normalizeCategories(post.categories).map((category) => (
                        <span key={category.slug}>{category.label}</span>
                      ))}
                    </div>
                  )}
                  <h3>{post.title}</h3>
                  {post.summary && <p>{post.summary}</p>}
                  <span className={styles.readMore}>{t("blog.readMore")}</span>
                </div>
              </Link>
            );
          })}
        </PostLayout>
      ) : !isLoading ? (
        <p className={styles.empty}>
          {posts.length > 0 ? t("blog.emptyFiltered") : t("blog.empty")}
        </p>
      ) : null}
      {!isLoading && <NewsletterSignup />}
    </section>
  );
}
