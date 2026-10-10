import "server-only";
import {getDb} from "./mongo";
import {isMailConfigured, sendMail} from "./mail";
import {getConfiguredSiteOrigin} from "./requestOrigin";
import {isBlogEnabled} from "./siteProfile";
import {renderBrandedEmail} from "./emailTemplates";
import {fetchIpGeolocationGeo, normalizeIp, isPrivateIp} from "./requestGeo";
import {newsletterContent, newsletterMessage} from "./newsletterCore.mjs";
import {normalizeSubscriberLocation} from "./subscriberLocation.mjs";
import {serializePost} from "./posts";
import {deliverNextNewsletter, requestSubscription, changeSubscription, normalizeEmail} from "./newsletterCore.mjs";

async function renderNewsletterMessage(options) {
  const content = newsletterContent(options);
  const message = newsletterMessage(options);
  return {...message, html: await renderBrandedEmail({
    language: options.language,
    origin: new URL(options.url).origin,
    eyebrow: "Newsletter",
    preheader: content.body,
    title: content.title || content.heading,
    paragraphs: [content.body],
    ctas: [{href: content.url, label: content.action},
      ...(content.unsubscribeUrl ? [{href: content.unsubscribeUrl, label: content.unsubscribe}] : [])],
    fallbackLink: content.url,
  })};
}

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
async function locateSubscriber(address) {
  const publicIp = normalizeIp(address);
  if (!publicIp || isPrivateIp(publicIp)) return null;
  return normalizeSubscriberLocation(await fetchIpGeolocationGeo(publicIp));
}

export async function subscribeNewsletter(input, ip, requestOrigin) {
  const email = normalizeEmail(input.email);
  if (!email || input.consent !== true) return {status: 400, error: "invalid"};
  if (input.website) return {status: 200};
  const origin = requestOrigin || newsletterOrigin();
  if (!(await isBlogEnabled()) || !(await isMailConfigured())) return {status: 503, error: "unavailable"};
  return requestSubscription({db: await database(), send: sendMail, origin, input, ip, renderMessage: renderNewsletterMessage,
    locate: locateSubscriber});
}
export async function manageNewsletter(action, token, ip) {
  return changeSubscription({db: await database(), action, token, ip, locate: locateSubscriber});
}

export async function processNewsletter(requestOrigin) {
  const origin = requestOrigin || newsletterOrigin();
  if (!(await isBlogEnabled()) || !(await isMailConfigured())) return {paused: true};
  return deliverNextNewsletter({db: await database(), origin, send: sendMail, renderMessage: renderNewsletterMessage,
    localize: (post, language) => serializePost(post, {language, includeContent: false})});
}
