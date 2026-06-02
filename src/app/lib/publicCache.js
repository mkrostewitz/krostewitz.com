import "server-only";

import {revalidateTag} from "next/cache";

export const PUBLIC_CACHE_REVALIDATE_SECONDS = 5 * 60;
export const PUBLIC_CACHE_STALE_SECONDS = 30 * 60;
export const PUBLIC_BROWSER_CACHE_SECONDS = 60;

export const PUBLIC_CACHE_HEADERS = {
  "Cache-Control": `public, max-age=${PUBLIC_BROWSER_CACHE_SECONDS}, s-maxage=${PUBLIC_CACHE_REVALIDATE_SECONDS}, stale-while-revalidate=${PUBLIC_CACHE_STALE_SECONDS}`,
};

export const PUBLIC_CACHE_TAGS = {
  cv: "public-cv-downloads",
  portfolio: "public-github-portfolio",
  posts: "public-posts",
  profile: "public-site-profile",
  translations: "public-site-translations",
};

export function revalidatePublicTags(...tags) {
  for (const tag of tags.filter(Boolean)) {
    try {
      revalidateTag(tag);
    } catch (error) {
      console.warn(`Unable to revalidate public cache tag "${tag}"`, error);
    }
  }
}
