import {NextResponse} from "next/server";

import {
  getDefaultSiteMetadata,
  getSiteProfile,
} from "../../../lib/siteProfile";

export const runtime = "nodejs";

export async function GET() {
  try {
    const profile = await getSiteProfile();
    return NextResponse.json({profile});
  } catch (error) {
    console.warn("Unable to load site profile", error);
    return NextResponse.json({
      profile: {
        address: null,
        blogEnabled: true,
        metadata: getDefaultSiteMetadata(),
        updatedAt: null,
        updatedBy: null,
      },
    });
  }
}
