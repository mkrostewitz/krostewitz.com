import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../lib/adminAuth';
import {getDb} from '../../../lib/mongo';
import {getExperienceCatalog, resolveExperienceIndustry} from '../../../lib/experienceClassifications.mjs';
import {createSkill, SkillsCollectionError} from '../../../lib/skills';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try { return NextResponse.json(await getExperienceCatalog(await getDb()), {headers: {'Cache-Control': 'no-store'}}); }
  catch (error) { console.error('Experience catalog', error); return NextResponse.json({error: 'Unable to load classifications.'}, {status: 503}); }
}
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  const input = await request.json().catch(() => null);
  if (!['industries', 'competencies'].includes(input?.taxonomy) || typeof input?.label !== 'string' || !input.label.trim() || input.label.length > 100) return NextResponse.json({error: 'Enter a classification of at most 100 characters.'}, {status: 400});
  try { return NextResponse.json(input.taxonomy === 'competencies' ? await createSkill(input.label, user) : await resolveExperienceIndustry(await getDb(), input.label)); }
  catch (error) { if (error instanceof SkillsCollectionError) return NextResponse.json({error: error.message}, {status: error.status}); console.error('Experience classification', error); return NextResponse.json({error: 'Unable to save classification.'}, {status: 503}); }
}
