import Link from "next/link";
import {notFound, redirect} from "next/navigation";

import {
  FALLBACK_LANGUAGE,
  normalizeLanguage,
} from "../../../../../lib/languageDetection";
import {
  getSupportedSiteLanguage,
  SITE_LANGUAGES,
} from "../../../../../lib/siteLanguages";
import NavBar from "../../../../components/nav/nav";
import PublicFooter from "../../../../components/footer/PublicFooter";
import {getCurrentAdminUser} from "../../../../lib/adminAuth";
import {getAdminPostById, PostValidationError} from "../../../../lib/posts";
import BlogImageCarousel from "../../../../blog/[slug]/BlogImageCarousel";
import blogStyles from "../../../../blog/[slug]/blog-post.module.css";
import adminStyles from "../../../admin.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Post preview",
  robots: {
    follow: false,
    index: false,
  },
};

function formatDate(value, language) {
  if (!value) return "";

  return new Intl.DateTimeFormat(language || FALLBACK_LANGUAGE, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function hasContentImageMarkup(value) {
  return /<(?:figure|img)\b[^>]*(?:data-content-image|src=)/i.test(
    String(value || "")
  );
}

function normalizeTranslation(value = {}) {
  return {
    title: String(value.title || ""),
    summary: String(value.summary || ""),
    contentHtml: String(value.contentHtml || ""),
  };
}

function hasTranslationContent(translation) {
  return Boolean(
    String(translation?.title || "").trim() ||
      String(translation?.summary || "").trim() ||
      String(translation?.contentHtml || "")
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim() ||
      hasContentImageMarkup(translation?.contentHtml)
  );
}

async function getPreviewLanguage(searchParams) {
  const resolvedSearchParams = await searchParams;

  return (
    getSupportedSiteLanguage(
      normalizeLanguage(
        resolvedSearchParams?.lng || resolvedSearchParams?.language || ""
      )
    ) || FALLBACK_LANGUAGE
  );
}

function getPreviewTranslation(post, language) {
  const requestedTranslation = normalizeTranslation(post?.translations?.[language]);

  if (hasTranslationContent(requestedTranslation)) {
    return requestedTranslation;
  }

  const fallbackTranslation = normalizeTranslation(
    post?.translations?.[FALLBACK_LANGUAGE]
  );

  if (hasTranslationContent(fallbackTranslation)) {
    return fallbackTranslation;
  }

  return normalizeTranslation(post);
}

function getMediaIdentity(media) {
  return media?.key || media?.url || "";
}

function getPostImageGallery(post) {
  const gallery = [];
  const seen = new Set();
  const candidates = [
    post?.media?.type === "image" ? post.media : null,
    ...(Array.isArray(post?.mediaGallery) ? post.mediaGallery : []),
  ];

  for (const media of candidates) {
    if (!media || media.type !== "image" || !media.url) continue;

    const identity = getMediaIdentity(media);

    if (!identity || seen.has(identity)) continue;

    gallery.push(media);
    seen.add(identity);
  }

  return gallery;
}

function getPostLanguageHref(postId, language) {
  return `/admin/posts/${postId}/preview?lng=${language}`;
}

export default async function AdminPostPreviewPage({params, searchParams}) {
  const user = await getCurrentAdminUser();

  if (!user) {
    redirect("/admin/login");
  }

  const {postId} = await params;
  const language = await getPreviewLanguage(searchParams);
  let post = null;

  try {
    post = await getAdminPostById(postId);
  } catch (error) {
    if (error instanceof PostValidationError) {
      notFound();
    }

    throw error;
  }

  if (!post) {
    notFound();
  }

  const translation = getPreviewTranslation(post, language);
  const previewPost = {
    ...post,
    title: translation.title || post.title,
    summary: translation.summary || post.summary,
    contentHtml: translation.contentHtml || post.contentHtml || "",
  };
  const imageGallery = getPostImageGallery(previewPost);
  const videoMedia =
    previewPost.media?.type === "video" && previewPost.media.url
      ? previewPost.media
      : null;

  return (
    <div className={blogStyles.page} id="top">
      <NavBar />

      <main className={blogStyles.main}>
        <div className={adminStyles.postPreviewBanner}>
          <div>
            <strong>Preview</strong>
            <span>
              {previewPost.status === "published"
                ? "Published post preview"
                : "Draft preview"}
            </span>
          </div>
          <Link href={`/admin/posts/${previewPost.id}`}>Edit post</Link>
        </div>

        <article className={blogStyles.article}>
          <header className={blogStyles.header}>
            <span className={blogStyles.date}>
              {formatDate(
                previewPost.publishedAt || previewPost.updatedAt,
                language
              )}
            </span>
            {Array.isArray(previewPost.categories) &&
              previewPost.categories.length > 0 && (
                <div className={blogStyles.categories}>
                  {previewPost.categories.map((category) => (
                    <span key={category.slug}>{category.label}</span>
                  ))}
                </div>
              )}
            <h1>{previewPost.title}</h1>
            {previewPost.summary && <p>{previewPost.summary}</p>}
            <nav
              className={blogStyles.postLanguageSwitch}
              aria-label="Post language"
            >
              {SITE_LANGUAGES.map((item) => {
                const isActive = item.code === language;

                return (
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`${blogStyles.postLanguageLink} ${
                      isActive ? blogStyles.postLanguageLinkActive : ""
                    }`}
                    href={getPostLanguageHref(previewPost.id, item.code)}
                    key={item.code}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </header>

          {videoMedia && (
            <div className={blogStyles.media}>
              <video controls src={videoMedia.url} />
            </div>
          )}

          <BlogImageCarousel images={imageGallery} />

          <div
            className={blogStyles.content}
            dangerouslySetInnerHTML={{__html: previewPost.contentHtml}}
          />
        </article>
      </main>
      <PublicFooter />
    </div>
  );
}
