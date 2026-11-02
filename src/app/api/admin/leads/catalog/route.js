import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../../lib/adminAuth';
import {getDb} from '../../../../lib/mongo';
import {normalizeLeadType, saveLeadType} from '../../../../lib/leadTypes.mjs';
import {normalizeLeadSource, saveLeadSource} from '../../../../lib/leadSource.mjs';
async function catalog(db) {
  const [types, sources] = await Promise.all([
    db.collection('leadTypes').find({}).sort({label: 1}).toArray(),
    db.collection('lead_sources').find({}).sort({label: 1}).toArray(),
  ]);
  return {leadTypes: types.map(row => row.label), sources: sources.map(row => row.label)};
}
export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try { return NextResponse.json(await catalog(await getDb()), {headers: {'Cache-Control': 'no-store'}}); }
  catch { return NextResponse.json({error: 'Unable to load contact types and sources.'}, {status: 500}); }
}
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  const input = await request.json().catch(() => null);
  let label;
  try {
    if (!['type', 'source'].includes(input?.kind)) throw new Error('Choose contact type or source.');
    label = input.kind === 'type' ? normalizeLeadType(input.label) : normalizeLeadSource(input.label);
    if (!label) throw new Error('Enter a name.');
  } catch (error) { return NextResponse.json({error: error.message}, {status: 400}); }
  try {
    const db = await getDb();
    if (input.kind === 'type') await saveLeadType(db.collection('leadTypes'), label);
    else await saveLeadSource(db, label);
    return NextResponse.json(await catalog(db));
  } catch { return NextResponse.json({error: 'Unable to save this choice.'}, {status: 500}); }
}
