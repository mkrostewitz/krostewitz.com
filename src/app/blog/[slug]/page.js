/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import {notFound} from "next/navigation";

import NavBar from "../../components/nav/nav";
import {getPublishedPostBySlug} from "../../lib/posts";
import styles from "./blog-post.module.css";
import ShareButtons from "./ShareButtons";

export const dynamic = "force-dynamic";

function formatDate(value) {
  if (!value) return "";

  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_BASE_URL ||
    "https://krostewitz.com"
  ).replace(/\/+$/, "");
}

export async function generateMetadata({params}) {
  const {slug} = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    return {
      title: "Post not found - Mathias Krostewitz",
    };
  }

  const title = `${post.title} - Mathias Krostewitz`;
  const description = post.summary;
  const url = `${getSiteUrl()}/blog/${post.slug}`;
  const image =
    post.media?.type === "image" && post.media.url ? post.media.url : undefined;

  return {
    title,
    description,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title,
      description,
      type: "article",
      url,
      publishedTime: post.publishedAt || undefined,
      images: image ? [{url: image}] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogPostPage({params}) {
  const {slug} = await params;
  const post = await getPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const postUrl = `${getSiteUrl()}/blog/${post.slug}`;

  return (
    <div className={styles.page} id="top">
      <NavBar />

      <main className={styles.main}>
        <Link className={styles.backLink} href="/#blog">
          Back to blog
        </Link>

        <article className={styles.article}>
          <header className={styles.header}>
            <span className={styles.date}>
              {formatDate(post.publishedAt || post.updatedAt)}
            </span>
            <h1>{post.title}</h1>
            {post.summary && <p>{post.summary}</p>}
            <ShareButtons
              summary={post.summary}
              title={post.title}
              url={postUrl}
            />
          </header>

          {post.media && (
            <div className={styles.media}>
              {post.media.type === "image" ? (
                <img src={post.media.url} alt="" />
              ) : (
                <video controls src={post.media.url} />
              )}
            </div>
          )}

          <div
            className={styles.content}
            dangerouslySetInnerHTML={{__html: post.contentHtml}}
          />

          <ShareButtons
            summary={post.summary}
            title={post.title}
            url={postUrl}
          />
        </article>
      </main>
    </div>
  );
}
