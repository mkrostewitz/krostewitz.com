import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {CV_CHUNK_BYTES, CV_MAX_BYTES, decodeCvChunk} from './cvUploadChunks.mjs';

test('chunks reassemble a 5.2 MB PDF without changing its bytes',()=>{
 const pdf=Buffer.alloc(Math.ceil(5.2*1024*1024),42);pdf.write('%PDF-1.7');
 const chunks=[];
 for(let i=0;i*CV_CHUNK_BYTES<pdf.length;i++) chunks.push(decodeCvChunk(pdf.subarray(i*CV_CHUNK_BYTES,(i+1)*CV_CHUNK_BYTES).toString('base64'),i,pdf.length));
 assert.deepEqual(Buffer.concat(chunks),pdf);
 assert.throws(()=>decodeCvChunk('???',0,10));
 assert.throws(()=>decodeCvChunk('YQ==',0,20));
 assert.throws(()=>decodeCvChunk('YQ==',-1,1));
});

test('authenticated upload route completes large PDF and rejects invalid ordering and ownership',async()=>{
 const source=await readFile(new URL('../api/admin/cv/upload/route.js',import.meta.url),'utf8');
 const body=source.replace(/^import .*;\n/gm,'').replace('export const runtime = "nodejs";','').replace('export async function POST','async function POST');
 const docs=new Map();let owner='admin@example.com';let saved;
 class UploadError extends Error {constructor(message,status=400){super(message);this.status=status;}}
 const matches=(doc,f)=>doc && doc.owner===f.owner && doc.expiresAt>f.expiresAt.$gt && (f.nextIndex===undefined||doc.nextIndex===f.nextIndex);
 const collection={
  createIndex:async()=>{},deleteMany:async()=>{},
  insertOne:async d=>docs.set(d._id,d),
  findOne:async f=>matches(docs.get(f._id),f)?structuredClone(docs.get(f._id)):null,
  updateOne:async(f,u)=>{const d=docs.get(f._id);if(!matches(d,f))return {matchedCount:0};d.chunks.push(u.$push.chunks);d.nextIndex++;return {matchedCount:1};},
  findOneAndDelete:async f=>{const d=docs.get(f._id);if(!matches(d,f))return null;docs.delete(f._id);return d;},
  deleteOne:async f=>{if(matches(docs.get(f._id),f))docs.delete(f._id);}
 };
 const post=new Function('randomUUID','NextResponse','getCurrentAdminUser','isSameOriginRequest','unauthorizedResponse','getDb','normalizeCvLanguage','saveCvDownload','CvFileError','uploadCvAsset','UploadError','CV_CHUNK_BYTES','CV_MAX_BYTES','decodeCvChunk',body+';return POST;')(
 ()=>String(Math.random()),Response,async()=>({email:owner}),()=>true,()=>Response.json({},{status:401}),async()=>({collection:()=>collection}),
 x=>x,async(lang,asset)=>({[lang]:asset}),UploadError,async file=>{saved=await file.arrayBuffer();return {url:'https://example.com/cv.pdf'};},UploadError,CV_CHUNK_BYTES,CV_MAX_BYTES,decodeCvChunk);
 const send=data=>post(new Request('https://example.com/api/admin/cv/upload',{method:'POST',body:JSON.stringify(data)}));
 const pdf=Buffer.alloc(Math.ceil(5.2*1024*1024),42);pdf.write('%PDF-1.7');
 const {uploadId}=await (await send({action:'begin',language:'en',fileName:'cv.pdf',size:pdf.length})).json();
 assert.equal((await send({action:'complete',uploadId})).status,400);
 const data=pdf.subarray(0,CV_CHUNK_BYTES).toString('base64');
 owner='other@example.com';assert.equal((await send({action:'chunk',uploadId,index:0,data})).status,410);
 owner='admin@example.com';assert.equal((await send({action:'chunk',uploadId,index:1,data})).status,409);
 for(let index=0;index*CV_CHUNK_BYTES<pdf.length;index++){
  assert.equal((await send({action:'chunk',uploadId,index,data:pdf.subarray(index*CV_CHUNK_BYTES,(index+1)*CV_CHUNK_BYTES).toString('base64')})).status,200);
 }
 assert.equal((await send({action:'complete',uploadId})).status,201);
 assert.deepEqual(saved,pdf);assert.equal(docs.size,0);
 assert.equal((await send({action:'complete',uploadId})).status,410);
});
