import {NextResponse} from "next/server";

import {
  getDefaultTranslations,
  getRuntimeTranslationResources,
} from "../../../lib/siteContent";
import {
  PUBLIC_CACHE_HEADERS,
} from "../../../lib/publicCache";
import {buildResourcesFromTranslations} from "../../../../lib/translationResources";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const resources = await getRuntimeTranslationResources();
    return NextResponse.json({resources}, {headers: PUBLIC_CACHE_HEADERS});
  } catch (error) {
    console.warn("Unable to load stored translations", error);
    const resources = buildResourcesFromTranslations(getDefaultTranslations());
    return NextResponse.json({resources}, {headers: PUBLIC_CACHE_HEADERS});
  }
}
