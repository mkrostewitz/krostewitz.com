import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../../lib/adminAuth';
import {importAdminLeads, LeadValidationError} from '../../../../lib/leads';
export const runtime = 'nodejs';
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    const raw = await request.text();
    if (raw.length > 2_000_000) return NextResponse.json({error: 'Import is too large.'}, {status: 413});
    let body;
    try { body = JSON.parse(raw); } catch { throw new LeadValidationError('Invalid import data.'); }
    const data = await importAdminLeads(body?.entries, user, body?.commit !== true);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({error: error instanceof LeadValidationError ? error.message : 'Unable to import leads. Please try again.'}, {status: error instanceof LeadValidationError ? error.status : 500});
  }
}
