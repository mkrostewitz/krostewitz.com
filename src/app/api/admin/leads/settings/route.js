import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../../lib/adminAuth';
import {getLeadSettings, saveLeadSettings} from '../../../../lib/leadSettings';
import {OutreachValidationError} from '../../../../lib/leadOutreach.mjs';

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try { return NextResponse.json(await getLeadSettings(), {headers: {'Cache-Control': 'no-store'}}); }
  catch { return NextResponse.json({error: 'Unable to load required fields.'}, {status: 500}); }
}
export async function PUT(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try { return NextResponse.json(await saveLeadSettings(await request.json().catch(() => null), user)); }
  catch (error) { return NextResponse.json({error: error instanceof OutreachValidationError ? error.message : 'Unable to save required fields.'}, {status: error instanceof OutreachValidationError ? 400 : 500}); }
}
