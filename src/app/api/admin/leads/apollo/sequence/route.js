import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../../../lib/adminAuth';
import {manageAdminLeadSequence, LeadValidationError} from '../../../../../lib/leads';
import {ApolloEnrichmentError} from '../../../../../lib/apolloEnrichment.mjs';
import {OutreachValidationError} from '../../../../../lib/leadOutreach.mjs';
export const runtime = 'nodejs';
export const maxDuration = 300;
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    if (!body?.leadId) throw new LeadValidationError('Choose a saved lead.', 400);
    const {action, sequenceId, targetSequenceId} = body;
    return NextResponse.json(await manageAdminLeadSequence(body.leadId, {action, sequenceId, targetSequenceId}, user));
  } catch (error) {
    const known = error instanceof LeadValidationError || error instanceof ApolloEnrichmentError || error instanceof OutreachValidationError;
    return NextResponse.json({error: known ? error.message : 'Unable to change sequence membership. Refresh Apollo status before retrying.'}, {status: known ? error.status : 502});
  }
}
