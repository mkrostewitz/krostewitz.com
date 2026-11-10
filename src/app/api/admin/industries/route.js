import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../lib/adminAuth';
import {getDb} from '../../../lib/mongo';
import {getIndustries, createIndustry, normalizeIndustryEdit, updateIndustry, validateIndustryDelete, deleteIndustry} from '../../../lib/industryStorage.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try { return NextResponse.json({industries: await getIndustries(await getDb())}, {headers: {'Cache-Control': 'no-store'}}); }
  catch (error) { console.error('Industries', error); return NextResponse.json({error: 'Unable to load industries.'}, {status: 503}); }
}
async function save(request, edit) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  const input = await request.json().catch(() => null);
  try {
    if (edit) normalizeIndustryEdit(input);
    else if (typeof input?.label !== 'string' || !input.label.trim() || input.label.length > 100) throw new Error('Enter an industry of at most 100 characters.');
  } catch (error) { return NextResponse.json({error: error.message}, {status: 400}); }
  try {
    const db = await getDb();
    const industry = edit ? await updateIndustry(db, input, user) : await createIndustry(db, input.label);
    return NextResponse.json({industry});
  } catch (error) {
    if (error.status === 409) return NextResponse.json({error: error.message}, {status: 409});
    console.error('Save industry', error);
    return NextResponse.json({error: 'Unable to save industry.'}, {status: 503});
  }
}
export async function POST(request) { return save(request, false); }
export async function PATCH(request) { return save(request, true); }

export async function DELETE(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  const input = await request.json().catch(() => null);
  try {
    validateIndustryDelete(input);
    await deleteIndustry(await getDb(), input);
    return NextResponse.json({deleted: true});
  } catch (error) {
    if ([400, 409].includes(error.status)) return NextResponse.json({error: error.message}, {status: error.status});
    console.error('Delete industry', error);
    return NextResponse.json({error: 'Unable to delete industry.'}, {status: 503});
  }
}
