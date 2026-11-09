import test from 'node:test';
import assert from 'node:assert/strict';
import {uploadCvFile} from './uploadCvClient.mjs';
test('client transfers a 5.2 MB PDF in small requests and finishes before reporting success',async(t)=>{
 const received=[];const actions=[];const progress=[];
 t.mock.method(globalThis,'fetch',async(url,options)=>{
  assert.equal(url,'/api/admin/cv/upload');
  assert.ok(Buffer.byteLength(options.body)<1500000);
  const body=JSON.parse(options.body);actions.push(body.action);
  if(body.action==='begin')return Response.json({uploadId:'test',chunkBytes:1024*1024});
  if(body.action==='chunk'){received.push(Buffer.from(body.data,'base64'));return Response.json({ok:true});}
  return Response.json({asset:{url:'https://example.com/cv.pdf'},downloads:{en:{}}});
 });
 const previous=globalThis.FileReader;
 globalThis.FileReader=class {readAsDataURL(blob){blob.arrayBuffer().then(buffer=>{this.result='data:application/pdf;base64,'+Buffer.from(buffer).toString('base64');this.onload();});}};
 try {
  const bytes=Buffer.alloc(Math.ceil(5.2*1024*1024),42);bytes.write('%PDF-1.7');
  const file=new File([bytes],'cv.pdf',{type:'application/pdf'});
  await uploadCvFile(file,'en',value=>progress.push(value));
  assert.deepEqual(Buffer.concat(received),bytes);
  assert.deepEqual(actions,['begin',...Array(6).fill('chunk'),'complete']);
  assert.equal(progress.at(-1),100);
 }finally{if(previous)globalThis.FileReader=previous;else delete globalThis.FileReader;}
});
