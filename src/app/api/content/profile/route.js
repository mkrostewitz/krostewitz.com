import {NextResponse} from "next/server";

import {getSiteProfile} from "../../../lib/siteProfile";

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
        updatedAt: null,
        updatedBy: null,
      },
    });
  }
}
