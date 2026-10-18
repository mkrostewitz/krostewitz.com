import {NextResponse} from "next/server";
import {getCvTimeline} from "../../../lib/cvTimeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const {entries} = await getCvTimeline();
    return NextResponse.json({entries}, {headers: {"Cache-Control": "no-store"}});
  } catch (error) {
    console.error("Unable to load CV timeline", error);
    return NextResponse.json({error: "Unable to load CV timeline."}, {status: 503});
  }
}
