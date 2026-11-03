import {NextResponse} from 'next/server';
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from '../../../../lib/adminAuth';
import {allowedLeadPhotoHost} from '../../../../lib/storage';
import {normalizeLeadPhotoUrl} from '../../../../lib/leadPhoto.mjs';

export const runtime = 'nodejs';
export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: 'Invalid request origin.'}, {status: 403});
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const body = await request.json();
    const url = new URL(normalizeLeadPhotoUrl(body.url));
    if (url.port || !allowedLeadPhotoHost(url.hostname)) return NextResponse.json({error: 'This photo provider does not support editing here. Upload a copy to crop it.'}, {status: 400});
    const response = await fetch(url, {redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15000)});
    const type = response.headers.get('content-type')?.split(';')[0];
    if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new Error('Invalid photo');
    const limit = 10 * 1024 * 1024;
    if (Number(response.headers.get('content-length')) > limit) {await response.body?.cancel(); throw new Error('Too large');}
    const reader = response.body.getReader();
    const chunks = []; let size = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {await reader.cancel(); throw new Error('Too large');}
      chunks.push(Buffer.from(value));
    }
    return new Response(Buffer.concat(chunks), {headers: {'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}});
  } catch {
    return NextResponse.json({error: 'Unable to load this photo for editing. Upload a JPG, PNG, or WebP copy instead.'}, {status: 400});
  }
}
