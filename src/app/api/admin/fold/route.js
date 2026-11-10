import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../lib/adminAuth';
import {getDefaultTranslations, getMergedTranslations, saveFoldTranslations} from '../../../lib/siteContent';
import {validateFoldTranslations} from '../../../lib/foldContent.mjs';

export const runtime = 'nodejs';

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const translations = await getMergedTranslations();
    const defaults = getDefaultTranslations();
    return NextResponse.json({translations: Object.fromEntries(['en', 'de'].map(language => [language, {...defaults[language].offer, ...translations[language]?.offer}]))});
  } catch {
    return NextResponse.json({error: 'Unable to load Fold / Hero settings.'}, {status: 500});
  }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  let translations;
  try {translations = validateFoldTranslations((await request.json()).translations);}
  catch (error) {return NextResponse.json({error: error.message}, {status: 400});}
  try {
    await saveFoldTranslations(translations, user);
    return NextResponse.json({translations});
  } catch {
    return NextResponse.json({error: 'Unable to save Fold / Hero settings.'}, {status: 500});
  }
}
