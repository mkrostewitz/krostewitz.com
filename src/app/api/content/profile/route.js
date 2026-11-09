import {publicAddress} from "../../../lib/publicAddress.mjs";
import {NextResponse} from "next/server";
import {publicReferences} from "../../../lib/references.mjs";

import {
  getDefaultAiChatIntegration,
  getDefaultKoalendarIntegration,
  getDefaultProfileName,
  getDefaultSiteMetadata,
  getSiteProfile,
} from "../../../lib/siteProfile";
import {
  PUBLIC_CACHE_HEADERS,
} from "../../../lib/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const profile = await getSiteProfile();
    return NextResponse.json({profile: {...profile, address: publicAddress(profile.address), references: publicReferences(profile)}}, {headers: PUBLIC_CACHE_HEADERS});
  } catch (error) {
    console.warn("Unable to load site profile", error);
    return NextResponse.json(
      {
        profile: {
          address: null,
          aiChat: getDefaultAiChatIntegration(),
          blogEnabled: true,
          labEnabled: false,
          personalEnabled: false,
          referencesEnabled: false,
          references: {mode: "cards", items: []},
          koalendar: getDefaultKoalendarIntegration(),
          metadata: getDefaultSiteMetadata(),
          name: getDefaultProfileName(),
          skillsEnabled: true,
          updatedAt: null,
          updatedBy: null,
        },
      },
      {headers: PUBLIC_CACHE_HEADERS}
    );
  }
}
