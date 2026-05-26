import {NextResponse} from "next/server";

import {
  getDefaultTranslations,
  getRuntimeTranslationResources,
} from "../../../lib/siteContent";
import {buildResourcesFromTranslations} from "../../../../lib/translationResources";

export const runtime = "nodejs";

export async function GET() {
  try {
    const resources = await getRuntimeTranslationResources();
    return NextResponse.json({resources});
  } catch (error) {
    console.warn("Unable to load stored translations", error);
    const resources = buildResourcesFromTranslations(getDefaultTranslations());
    return NextResponse.json({resources});
  }
}
