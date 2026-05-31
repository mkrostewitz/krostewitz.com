/* eslint-disable @next/next/no-img-element */

import {cookies} from "next/headers";
import {notFound} from "next/navigation";

import {
  FALLBACK_LANGUAGE,
  normalizeLanguage,
} from "../../../lib/languageDetection";
import {
  getSupportedSiteLanguage,
  LANGUAGE_COOKIE_NAME,
} from "../../../lib/siteLanguages";
import NavBar from "../../components/nav/nav";
import PublicFooter from "../../components/footer/PublicFooter";
import {getPublishedPostBySlug} from "../../lib/posts";
import {getCurrentRequestOrigin} from "../../lib/requestOrigin";
import {
  getDefaultSiteMetadata,
  getSiteMetadata,
  isBlogEnabled,
} from "../../lib/siteProfile";
import BlogBackLink from "./BlogBackLink";
import styles from "./blog-post.module.css";
import ShareButtons from "./ShareButtons";

export const dynamic = "force-dynamic";

function formatDate(value, language) {
  if (!value) return "";

  return new Intl.DateTimeFormat(language || FALLBACK_LANGUAGE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

async function getPostLanguage(searchParams) {
  const resolvedSearchParams = await searchParams;
  const queryLanguage = getSupportedSiteLanguage(
    resolvedSearchParams?.lng || resolvedSearchParams?.language
  );

  if (queryLanguage) return queryLanguage;

  const cookieStore = await cookies();
  return (
    getSupportedSiteLanguage(
      cookieStore.get(LANGUAGE_COOKIE_NAME)?.value ||
        cookieStore.get("NEXT_LOCALE")?.value
    ) ||
    getSupportedSiteLanguage(normalizeLanguage(cookieStore.get("i18next")?.value)) ||
    FALLBACK_LANGUAGE
  );
}

async function getSiteTitle() {
  try {
    return (await getSiteMetadata()).title;
  } catch {
    return getDefaultSiteMetadata().title;
  }
}

export async function generateMetadata({params, searchParams}) {
  const blogEnabled = await isBlogEnabled();
  const siteTitle = await getSiteTitle();
  const language = await getPostLanguage(searchParams);

  if (!blogEnabled) {
    return {
      title: `Post not found - ${siteTitle}`,
    };
  }

  const {slug} = await params;
  const post = await getPublishedPostBySlug(slug, {language});

  if (!post) {
    return {
      title: `Post not found - ${siteTitle}`,
    };
  }

  const title = `${post.title} - ${siteTitle}`;
  const description = post.summary;
  const siteUrl = await getCurrentRequestOrigin();
  const url = new URL(`/blog/${post.slug}`, siteUrl).toString();
  const image =
    post.media?.type === "image" && post.media.url ? post.media.url : undefined;
  const keywords = Array.isArray(post.categories)
    ? post.categories.map((category) => category.label).filter(Boolean)
    : [];

  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
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

export default async function BlogPostPage({params, searchParams}) {
  const blogEnabled = await isBlogEnabled();

  if (!blogEnabled) {
    notFound();
  }

  const {slug} = await params;
  const language = await getPostLanguage(searchParams);
  const post = await getPublishedPostBySlug(slug, {language});

  if (!post) {
    notFound();
  }

  const siteUrl = await getCurrentRequestOrigin();
  const postUrl = new URL(`/blog/${post.slug}`, siteUrl);
  postUrl.searchParams.set("lng", language);

  return (
    <div className={styles.page} id="top">
      <NavBar />

      <main className={styles.main}>
        <BlogBackLink />

        <article className={styles.article}>
          <header className={styles.header}>
            <span className={styles.date}>
              {formatDate(post.publishedAt || post.updatedAt, language)}
            </span>
            {Array.isArray(post.categories) && post.categories.length > 0 && (
              <div className={styles.categories}>
                {post.categories.map((category) => (
                  <span key={category.slug}>{category.label}</span>
                ))}
              </div>
            )}
            <h1>{post.title}</h1>
            {post.summary && <p>{post.summary}</p>}
            <ShareButtons
              summary={post.summary}
              title={post.title}
              url={postUrl.toString()}
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
            url={postUrl.toString()}
          />
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
