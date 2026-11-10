import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../lib/adminAuth';
import {getFoldContent, saveFoldContent} from '../../../lib/fold';
import {revalidatePath} from 'next/cache';
import {validateFoldContent} from '../../../lib/foldContent.mjs';

export const runtime = 'nodejs';

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    return NextResponse.json({content: await getFoldContent()});
  } catch {
    return NextResponse.json({error: 'Unable to load Fold / Hero settings.'}, {status: 500});
  }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  let content;
  try {content = validateFoldContent((await request.json()).content);}
  catch (error) {return NextResponse.json({error: error.message}, {status: 400});}
  try {
    const saved = await saveFoldContent(content, user);
    revalidatePath('/');
    return NextResponse.json({content: saved});
  } catch {
    return NextResponse.json({error: 'Unable to save Fold / Hero settings.'}, {status: 500});
  }
}
