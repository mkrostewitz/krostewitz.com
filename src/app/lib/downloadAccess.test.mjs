import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {DOWNLOAD_ACCESS_COOKIE, DOWNLOAD_ACCESS_SECONDS, setDownloadAccessCookie} from "./downloadAccess.mjs";
import {downloadWithExistingAccess} from "./downloadAccessClient.mjs";

test("issues a 24-hour HttpOnly cookie with secure HTTPS settings", () => {
  const calls = [];
  const response = {cookies: {set: (...args) => calls.push(args)}};
  assert.equal(setDownloadAccessCookie(response, "verified-token", true), response);
  assert.deepEqual(calls, [[DOWNLOAD_ACCESS_COOKIE, "verified-token", {httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: DOWNLOAD_ACCESS_SECONDS}]]);
  setDownloadAccessCookie(response, "", true);
  assert.equal(calls.length, 1);
});

test("cookie lookup restricts access to verified, unexpired download leads", async () => {
  const source = await readFile(new URL("./leads.js", import.meta.url), "utf8");
  const lookup = source.slice(source.indexOf("export async function getLeadByDownloadToken("), source.indexOf("export async function recordLeadDownload(")).replaceAll("export ", "");
  let query;
  const getCookieLead = new Function("getDb", "ensureLeadIndexes", "getLeadsCollection", "hashDownloadToken", "DOWNLOAD_ACCESS_COOKIE", `${lookup}\nreturn getLeadByDownloadCookie;`)(async () => ({}), async () => {}, () => ({findOne: async value => {query = value; return {_id: "verified-lead"};}}), token => `hashed:${token}`, DOWNLOAD_ACCESS_COOKIE);
  assert.equal(await getCookieLead({}), null);
  assert.equal(query, undefined);
  assert.deepEqual(await getCookieLead({cookies: {get: name => name === DOWNLOAD_ACCESS_COOKIE ? {value: "secret"} : undefined}}), {_id: "verified-lead"});
  assert.equal(query.downloadTokenHash, "hashed:secret");
  assert.equal(query["verification.status"], "verified");
  assert.deepEqual(query["source.type"], {$in: ["cv_download", "attachment_download"]});
  assert.ok(query.downloadTokenExpiresAt.$gt instanceof Date);
});

test("client downloads for verified access and falls back to registration otherwise", async t => {
  const locations = [];
  t.mock.method(globalThis, "fetch", async () => Response.json({verified: true}));
  const previousWindow = globalThis.window;
  globalThis.window = {location: {assign: url => locations.push(url)}};
  try {
    assert.equal(await downloadWithExistingAccess("/api/attachments/download", {documentId: "case study"}), true);
    assert.deepEqual(locations, ["/api/attachments/download?documentId=case+study"]);
    globalThis.fetch = async () => Response.json({verified: false});
    assert.equal(await downloadWithExistingAccess("/api/cv/download"), false);
    globalThis.fetch = async () => {throw new Error("offline");};
    assert.equal(await downloadWithExistingAccess("/api/cv/download"), false);
    assert.equal(locations.length, 1);
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});
