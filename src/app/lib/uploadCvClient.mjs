import {readCvUploadResponse} from './cvUploadResponse.mjs';
function base64(blob) {
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=>reject(new Error('Unable to read the PDF.'));
    reader.onload = ()=>resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}
export async function uploadCvFile(file, language, onProgress = ()=>{}) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a PDF up to 10 MB.');
  if (file.size <= 3 * 1024 * 1024) {
    const body = new FormData();
    body.append('language',language); body.append('file',file);
    return readCvUploadResponse(await fetch('/api/admin/cv',{method:'POST',body}));
  }
  let uploadId;
  const send = body=>fetch('/api/admin/cv/upload',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const step = async body=>readCvUploadResponse(await send(body), false);
  try {
    const start = await step({action:'begin',language,fileName:file.name,size:file.size});
    uploadId = start.uploadId;
    if (!uploadId || start.chunkBytes !== 1024 * 1024) throw new Error('Invalid upload session response.');
    for (let offset=0,index=0;offset<file.size;offset+=start.chunkBytes,index++) {
      await step({action:'chunk',uploadId,index,data:await base64(file.slice(offset,offset+start.chunkBytes))});
      onProgress(Math.round(Math.min(offset+start.chunkBytes,file.size)/file.size*100));
    }
    return await readCvUploadResponse(await send({action:'complete',uploadId}));
  } catch (error) {
    if (uploadId) await send({action:'cancel',uploadId}).catch(()=>{});
    throw error;
  }
}
