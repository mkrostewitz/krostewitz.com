import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const source = (await readFile(new URL("./route.js", import.meta.url), "utf8"))
  .replace(/^import .*;$/gm, "")
  .replace(/export /g, "");
const resolverSource = (await readFile(new URL("../../../lib/attachmentDownloads.js", import.meta.url), "utf8"))
  .replace(/^import .*;$/gm, "")
  .replace(/export /g, "");
const makeResolver = new Function("getCvTimeline", "getPublishedPostBySlug", `${resolverSource}\nreturn resolveDownloadAttachment;`);
const routeFactory = new Function("NextResponse", "getLeadByDownloadToken", "recordLeadDownload", "resolveDownloadAttachment", "fetch", "getLeadByDownloadCookie", `${source}\nreturn GET;`);
function makeHandler(response, getLead, record, getPost, fetchFile, getTimeline = async () => ({entries: []}), getCookieLead = () => getLead("", "attachment_download")) {
  return routeFactory(response, getLead, record, makeResolver(getTimeline, getPost), fetchFile, getCookieLead);
}
const asset = {key: "requested", fileName: "Résumé.pdf", mimeType: "application/pdf", url: "https://storage.example/requested"};
const lead = {_id: "lead", source: {context: {postSlug: "experience", attachmentKey: "requested"}}};

test("rejects missing, expired, and CV-only tokens before reading files", async () => {
  for (const token of ["", "expired", "cv-token"]) {
    const handler = makeHandler(Response, async (value, type) => {
      assert.equal(value, token);
      assert.equal(type, "attachment_download");
      return null;
    }, () => assert.fail("must not record"), () => assert.fail("must not load post"), () => assert.fail("must not fetch"));
    assert.equal((await handler(new Request(`https://example.com/api/attachments/download?token=${token}`))).status, 403);
  }
});

test("unpublished posts and removed attachments cannot be downloaded", async () => {
  for (const post of [null, {attachments: []}]) {
    const handler = makeHandler(Response, async () => lead, () => assert.fail("must not record"), async () => post, () => assert.fail("must not fetch"));
    assert.equal((await handler(new Request("https://example.com/?token=valid"))).status, 404);
  }
});

test("downloads only the registered attachment and records successful access", async () => {
  const recorded = [];
  const handler = makeHandler(Response, async () => lead, async id => recorded.push(id), async slug => {
    assert.equal(slug, "experience");
    return {attachments: [{...asset, key: "other", url: "https://storage.example/other"}, asset]};
  }, async url => {
    assert.equal(url, asset.url);
    return new Response("document");
  });
  const response = await handler(new Request("https://example.com/?token=valid&attachmentKey=other"));
  assert.equal(await response.text(), "document");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.match(response.headers.get("content-disposition"), /filename\*=UTF-8''R%C3%A9sum%C3%A9.pdf/);
  assert.deepEqual(recorded, ["lead"]);
});

test("failed storage downloads are not recorded", async () => {
  const handler = makeHandler(Response, async () => lead, () => assert.fail("must not record"), async () => ({attachments: [asset]}), async () => new Response(null, {status: 404}));
  assert.equal((await handler(new Request("https://example.com/?token=valid"))).status, 502);
});


test("experience documents resolve by entry and document IDs, ignoring supplied URLs", async () => {
  const timelineLead = {...lead, source: {context: {timelineEntryId: "role", documentId: "case-study"}}};
  const document = {id: "case-study", fileName: "Case study.pdf", url: "https://storage.example/case-study"};
  const recorded = [];
  const handler = makeHandler(Response, async () => timelineLead, async id => recorded.push(id), () => assert.fail("must not look up a blog post"), async url => {
    assert.equal(url, document.url);
    return new Response("case study");
  }, async () => ({entries: [{id: "other-role", documents: [{...document, url: "https://storage.example/other"}]}, {id: "role", documents: [document]}]}));
  const response = await handler(new Request("https://example.com/?token=valid&url=https://untrusted.example"));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pdf");
  assert.equal(await response.text(), "case study");
  assert.deepEqual(recorded, ["lead"]);
});

test("deleted experience documents or entries return 404", async () => {
  for (const entries of [[], [{id: "role", documents: []}], [{id: "other-role", documents: [{id: "case-study"}]}]]) {
    const handler = makeHandler(Response, async () => ({...lead, source: {context: {timelineEntryId: "role", documentId: "case-study"}}}), () => assert.fail("must not record"), () => assert.fail("must not read posts"), () => assert.fail("must not fetch"), async () => ({entries}));
    assert.equal((await handler(new Request("https://example.com/?token=valid"))).status, 404);
  }
});


test("a verified cookie grants another document and records it on the same lead", async () => {
  const records = [];
  const handler = makeHandler(Response, () => assert.fail("must use cookie"), async (...args) => records.push(args), async slug => {
    assert.equal(slug, "another-experience");
    return {attachments: [asset]};
  }, async () => new Response("another document"), undefined, async () => lead);
  const response = await handler(new Request("https://example.com/?postSlug=another-experience&attachmentKey=requested"));
  assert.equal(await response.text(), "another document");
  assert.equal(records[0][0], lead._id);
  assert.equal(records[0][1].postSlug, "another-experience");
  assert.equal(records[0][1].fileName, asset.fileName);
});

test("an expired cookie cannot access a document specified in the URL", async () => {
  const handler = makeHandler(Response, () => assert.fail("must use cookie"), () => assert.fail("must not record"), () => assert.fail("must not resolve"), () => assert.fail("must not fetch"), undefined, async () => null);
  assert.equal((await handler(new Request("https://example.com/?postSlug=experience&attachmentKey=requested"))).status, 403);
});
