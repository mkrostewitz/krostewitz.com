import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../../lib/adminAuth';
import {getDb} from '../../../../lib/mongo';
import {getCategoryTranslations, normalizeCategoryTranslation} from '../../../../lib/leadCategoryTranslations.mjs';

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try { return NextResponse.json(await getCategoryTranslations(await getDb()), {headers: {'Cache-Control': 'no-store'}}); }
  catch { return NextResponse.json({error: 'Unable to load translations.'}, {status: 500}); }
}
export async function PUT(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  let input;
  try { input = normalizeCategoryTranslation(await request.json()); }
  catch (error) { return NextResponse.json({error: error.message}, {status: 400}); }
  try {
    const db = await getDb();
    await db.collection(`lead_${input.kind}`).updateOne({_id: input.label.toLowerCase()},
      {$set: {label: input.label, translations: input.translations, updatedAt: new Date(), updatedBy: user.email}}, {upsert: true});
    return NextResponse.json(await getCategoryTranslations(db));
  } catch { return NextResponse.json({error: 'Unable to save translations.'}, {status: 500}); }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  const body = await request.json().catch(() => null);
  if (typeof body?.label !== 'string' || !body.label.trim() || body.label.length > 100) return NextResponse.json({error: 'Enter a label of up to 100 characters.'}, {status: 400});
  try {
    const {getAiSettings} = await import('../../../../lib/aiSettings');
    const {translateCategoryLabels} = await import('../../../../lib/leadCategoryAi.mjs');
    const {model} = await getAiSettings();
    const [translations] = await translateCategoryLabels({labels: [body.label], model, apiKey: process.env.OPENAI_API_KEY});
    return NextResponse.json({translations});
  } catch { return NextResponse.json({error: 'Unable to translate. Check AI settings or enter the translations manually.'}, {status: 502}); }
}
export const maxDuration = 120;
