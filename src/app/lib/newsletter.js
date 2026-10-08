import "server-only";
import {getDb} from "./mongo";
import {isMailConfigured, sendMail} from "./mail";
import {getConfiguredSiteOrigin} from "./requestOrigin";
import {isBlogEnabled} from "./siteProfile";
import {serializePost} from "./posts";
import {deliverNextNewsletter, requestSubscription, changeSubscription, normalizeEmail} from "./newsletterCore.mjs";

let indexes;
async function database() {
  const db = await getDb();
  if (!indexes) indexes = Promise.all([
    db.collection("newsletter_subscribers").createIndex({confirmationHash: 1}, {sparse: true}),
    db.collection("newsletter_subscribers").createIndex({unsubscribeToken: 1}, {sparse: true}),
    db.collection("newsletter_subscribers").createIndex({expiresAt: 1}, {expireAfterSeconds: 0}),
    db.collection("newsletter_rate_limits").createIndex({expiresAt: 1}, {expireAfterSeconds: 0}),
    db.collection("posts").createIndex({status: 1, "newsletter.availableAt": 1}),
  ]).catch((error) => { indexes = null; throw error; });
  await indexes;
  return db;
}
export function newsletterOrigin() {
  const origin = getConfiguredSiteOrigin();
  if (!origin) throw new Error("Configure NEXT_PUBLIC_SITE_URL for newsletter email links.");
  return origin;
}
export async function subscribeNewsletter(input, ip) {
  const email = normalizeEmail(input.email);
  if (!email || input.consent !== true) return {status: 400, error: "invalid"};
  if (input.website) return {status: 200};
  const origin = newsletterOrigin();
  if (!(await isBlogEnabled()) || !(await isMailConfigured())) return {status: 503, error: "unavailable"};
  return requestSubscription({db: await database(), send: sendMail, origin, input, ip});
}
export async function manageNewsletter(action, token) {
  return changeSubscription({db: await database(), action, token});
}

export async function processNewsletter() {
  const origin = newsletterOrigin();
  if (!(await isBlogEnabled()) || !(await isMailConfigured())) return {paused: true};
  return deliverNextNewsletter({db: await database(), origin, send: sendMail,
    localize: (post, language) => serializePost(post, {language, includeContent: false})});
}
