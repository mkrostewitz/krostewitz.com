import {NextResponse} from "next/server";

import {getSupportedSiteLanguage} from "../../../lib/siteLanguages";
import {
  PUBLIC_CACHE_HEADERS,
} from "../../lib/publicCache";
import {isBlogEnabled} from "../../lib/siteProfile";
import {getPublishedPostCategories, getPublishedPosts} from "../../lib/posts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const blogEnabled = await isBlogEnabled();

    if (!blogEnabled) {
      return NextResponse.json(
        {
          blogEnabled: false,
          categories: [],
          posts: [],
        },
        {headers: PUBLIC_CACHE_HEADERS}
      );
    }

    const {searchParams} = new URL(request.url);
    const language = getSupportedSiteLanguage(
      searchParams.get("language") || searchParams.get("lng")
    );
    const [posts, categories] = await Promise.all([
      getPublishedPosts({
        category: searchParams.get("category") || searchParams.get("tag") || "",
        language,
      }),
      getPublishedPostCategories(),
    ]);

    return NextResponse.json(
      {blogEnabled: true, posts, categories},
      {headers: PUBLIC_CACHE_HEADERS}
    );
  } catch (error) {
    console.error("Public posts API error", error);
    return NextResponse.json(
      {blogEnabled: false, posts: [], categories: []},
      {headers: PUBLIC_CACHE_HEADERS, status: 200}
    );
  }
}
