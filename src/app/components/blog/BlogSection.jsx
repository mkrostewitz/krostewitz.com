"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import pageStyles from "../../page.module.css";
import styles from "./blog-section.module.css";

function formatDate(value, language) {
  if (!value) return "";

  return new Intl.DateTimeFormat(language || "en", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export default function BlogSection() {
  const {t, i18n} = useTranslation();
  const [posts, setPosts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      try {
        const response = await fetch("/api/posts", {cache: "no-store"});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error("Unable to load posts.");
        }

        if (!cancelled) {
          setPosts(data.posts || []);
        }
      } catch {
        if (!cancelled) {
          setPosts([]);
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

  if (isLoading || posts.length === 0) return null;

  return (
    <section id="blog" className={`${pageStyles.section} ${styles.section}`}>
      <div className={styles.sectionHeader}>
        <span className={pageStyles.eyebrow}>{t("blog.eyebrow")}</span>
        <h2>{t("blog.title")}</h2>
        <p>{t("blog.subtitle")}</p>
      </div>

      <div className={styles.grid}>
        {posts.map((post) => (
          <Link
            className={styles.card}
            href={`/blog/${post.slug}`}
            key={post.id}
          >
            {post.media && (
              <div className={styles.media}>
                {post.media.type === "image" ? (
                  <img src={post.media.url} alt="" loading="lazy" />
                ) : (
                  <video
                    muted
                    playsInline
                    preload="metadata"
                    src={post.media.url}
                  />
                )}
              </div>
            )}

            <div className={styles.cardBody}>
              <span className={styles.date}>
                {formatDate(post.publishedAt || post.updatedAt, i18n.language)}
              </span>
              <h3>{post.title}</h3>
              {post.summary && <p>{post.summary}</p>}
              <span className={styles.readMore}>{t("blog.readMore")}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
