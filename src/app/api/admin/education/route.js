import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../lib/adminAuth';
import {getEducation, saveEducation} from '../../../lib/education';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try { return NextResponse.json(await getEducation(), {headers: {'Cache-Control': 'no-store'}}); }
  catch (error) { console.error('Education load', error); return NextResponse.json({error: 'Unable to load education.'}, {status: 503}); }
}
export async function PUT(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try { return NextResponse.json(await saveEducation(await request.json(), user)); }
  catch (error) { return NextResponse.json({error: error.message || 'Unable to save education.'}, {status: error.status || 400}); }
}
