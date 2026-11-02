import {NextResponse} from "next/server";
import {getCurrentAdminUser, unauthorizedResponse} from "../../../../lib/adminAuth";
import {getDb} from "../../../../lib/mongo";

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const rows = await (await getDb()).collection("lead_sources").find({}, {projection: {label: 1}}).sort({label: 1}).toArray();
    return NextResponse.json({sources: rows.map((row) => row.label)}, {headers: {"Cache-Control": "no-store"}});
  } catch { return NextResponse.json({error: "Unable to load saved sources."}, {status: 500}); }
}
