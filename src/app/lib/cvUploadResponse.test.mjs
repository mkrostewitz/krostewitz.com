import test from 'node:test';
import assert from 'node:assert/strict';
import {readCvUploadResponse} from './cvUploadResponse.mjs';
test('explains hosting rejection without JSON and includes request identifier',async()=>{
 await assert.rejects(readCvUploadResponse(new Response('Payload too large',{status:413,headers:{'x-nf-request-id':'test-request'}})),/smaller than 4 MB.*HTTP 413; request test-request/);
});
test('keeps actionable API errors and rejects unexpected successful responses',async()=>{
 await assert.rejects(readCvUploadResponse(Response.json({error:'Storage is not configured'},{status:500})),/Storage is not configured/);
 await assert.rejects(readCvUploadResponse(new Response('<html>Login</html>')),/unexpected response/);
 const data={asset:{url:'https://example.com/cv.pdf'},downloads:{en:{}}};
 assert.deepEqual(await readCvUploadResponse(Response.json(data)),data);
});
