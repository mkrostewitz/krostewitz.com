import {randomUUID} from "node:crypto";
import {NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../../lib/adminAuth";
import {getDb} from "../../../../lib/mongo";
import {normalizeCvLanguage, saveCvDownload, CvFileError} from "../../../../lib/cvFiles";
import {uploadCvAsset, UploadError} from "../../../../lib/storage";
import {CV_CHUNK_BYTES, CV_MAX_BYTES, decodeCvChunk} from "../../../../lib/cvUploadChunks.mjs";

export const runtime = "nodejs";

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error:"Invalid request origin."},{status:403});
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();
  try {
    const text = await request.text();
    if (text.length > 1500000) throw new UploadError("Upload request is too large.", 413);
    let body;
    try {body = JSON.parse(text);} catch {throw new UploadError("Invalid upload request.");}
    if (!body || typeof body !== "object") throw new UploadError("Invalid upload request.");
    const db = await getDb();
    const uploads = db.collection("cv_upload_sessions");
    if (body.action === "begin") {
      const language = normalizeCvLanguage(body.language);
      if (!Number.isInteger(body.size) || body.size < 5 || body.size > CV_MAX_BYTES) throw new UploadError("Choose a PDF up to 10 MB.");
      if (typeof body.fileName !== "string" || body.fileName.length > 250 || !/\.pdf$/i.test(body.fileName)) throw new UploadError("Choose a PDF file.");
      await uploads.createIndex({expiresAt:1}, {expireAfterSeconds:0});
      // One active upload per administrator; interrupted uploads expire automatically.
      await uploads.deleteMany({owner:user.email});
      const uploadId = randomUUID();
      await uploads.insertOne({_id:uploadId, owner:user.email, language, fileName:body.fileName, size:body.size, chunks:[], nextIndex:0, expiresAt:new Date(Date.now()+30*60*1000)});
      return NextResponse.json({uploadId, chunkBytes:CV_CHUNK_BYTES});
    }
    if (typeof body.uploadId !== "string") throw new UploadError("Invalid upload session.");
    const filter = {_id:body.uploadId, owner:user.email, expiresAt:{$gt:new Date()}};
    if (body.action === "cancel") {
      await uploads.deleteOne(filter);
      return NextResponse.json({ok:true});
    }
    const session = await uploads.findOne(filter);
    if (!session) throw new UploadError("Upload expired. Please select the PDF again.", 410);
    if (body.action === "chunk") {
      try {decodeCvChunk(body.data, body.index, session.size);} catch (error) {throw new UploadError(error.message);}
      const result = await uploads.updateOne({...filter, nextIndex:body.index}, {$push:{chunks:body.data}, $inc:{nextIndex:1}});
      if (!result.matchedCount) throw new UploadError("Upload chunks arrived out of order. Please retry.",409);
      return NextResponse.json({ok:true});
    }
    if (body.action !== "complete") throw new UploadError("Invalid upload action.");
    const count = Math.ceil(session.size/CV_CHUNK_BYTES);
    if (session.nextIndex !== count) throw new UploadError("Upload is incomplete.");
    const claimed = await uploads.findOneAndDelete({...filter, nextIndex:count});
    if (!claimed) throw new UploadError("Upload has already been processed.",409);
    const pdf = Buffer.concat(claimed.chunks.map((chunk,index)=>decodeCvChunk(chunk,index,claimed.size)));
    if (pdf.subarray(0,5).toString() !== "%PDF-") throw new UploadError("The file is not a valid PDF.");
    const asset = await uploadCvAsset({name:claimed.fileName,type:"application/pdf",size:pdf.length,arrayBuffer:async()=>pdf},claimed.language,user);
    const downloads = await saveCvDownload(claimed.language,asset,user);
    return NextResponse.json({asset:downloads[claimed.language],downloads},{status:201});
  } catch (error) {
    if (error instanceof UploadError || error instanceof CvFileError) return NextResponse.json({error:error.message},{status:error.status});
    console.error("CV chunk upload failed",error);
    return NextResponse.json({error:"Unable to finish the CV upload. Please retry or check the server logs."},{status:500});
  }
}
