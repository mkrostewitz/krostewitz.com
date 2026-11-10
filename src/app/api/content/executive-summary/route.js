import {NextResponse} from 'next/server';
import {getExecutiveSummary} from '../../../lib/executiveSummary';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const language = new URL(request.url).searchParams.get('language') === 'de' ? 'de' : 'en';
  try {
    return NextResponse.json(await getExecutiveSummary(language), {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error('Executive summary', error);
    return NextResponse.json({error: 'Unable to load executive summary.'}, {status: 503});
  }
}
