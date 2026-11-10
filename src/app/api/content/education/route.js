import {NextResponse} from 'next/server';
import {getEducation} from '../../../lib/education';
import {publicEducationEntries} from '../../../lib/educationData.mjs';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request) {
  const language = new URL(request.url).searchParams.get('language') === 'de' ? 'de' : 'en';
  try {
    const education = await getEducation();
    return NextResponse.json({entries: publicEducationEntries(education.entries, language)}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error('Unable to load education', error);
    return NextResponse.json({error: 'Unable to load education.'}, {status: 503});
  }
}
