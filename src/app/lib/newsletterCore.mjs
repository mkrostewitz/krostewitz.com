import crypto from "node:crypto";

export const hashToken = (value) => crypto.createHash("sha256").update(value).digest("hex");
export const newToken = () => crypto.randomBytes(32).toString("hex");
export const validToken = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
export function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(email) ? email : "";
}
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[char]));
export function newsletterMessage({language, title, summary, url, unsubscribeUrl}) {
  const de = language === "de";
  const heading = unsubscribeUrl ? (de ? "Neuer Artikel" : "New article") : (de ? "Newsletter-Anmeldung bestätigen" : "Confirm your newsletter subscription");
  const body = unsubscribeUrl ? summary : (de ? "Bitte bestätige deine Anmeldung. Der Link ist 24 Stunden gültig. Falls du dich nicht angemeldet hast, ignoriere diese E-Mail." : "Please confirm your subscription. This link expires in 24 hours. If you did not sign up, ignore this email.");
  const action = unsubscribeUrl ? (de ? "Artikel lesen" : "Read article") : (de ? "Anmeldung bestätigen" : "Confirm subscription");
  const unsubscribe = de ? "Newsletter abbestellen" : "Unsubscribe";
  return {
    subject: title ? `${heading}: ${title.replace(/[\r\n]/g, " ")}` : heading,
    text: `${heading}\n\n${title || ""}\n${body || ""}\n\n${action}: ${url}${unsubscribeUrl ? `\n\n${unsubscribe}: ${unsubscribeUrl}` : ""}`,
    html: `<h1>${escapeHtml(heading)}</h1>${title ? `<h2>${escapeHtml(title)}</h2>` : ""}<p>${escapeHtml(body)}</p><p><a href="${escapeHtml(url)}">${action}</a></p>${unsubscribeUrl ? `<p><a href="${escapeHtml(unsubscribeUrl)}">${unsubscribe}</a></p>` : ""}`,
  };
}

// Kept injectable so delivery behavior can be tested without real subscribers or SMTP.
export async function deliverNextNewsletter({db, send, origin, localize, now = new Date()}) {
  const posts = db.collection("posts");
  const lock = newToken();
  const post = await posts.findOneAndUpdate({
    status: "published", "newsletter.startedAt": {$exists: true},
    "newsletter.completedAt": {$exists: false},
    $or: [{"newsletter.availableAt": {$exists: false}}, {"newsletter.availableAt": {$lte: now}}],
  }, {$set: {"newsletter.lock": lock, "newsletter.availableAt": new Date(+now + 5 * 60000)}}, {
    sort: {"newsletter.availableAt": 1, "newsletter.startedAt": 1}, returnDocument: "after", includeResultMetadata: false,
  });
  if (!post) return {idle: true};
  const guard = {_id: post._id, "newsletter.lock": lock};
  const subscribers = db.collection("newsletter_subscribers");
  const subscriber = await subscribers.findOne({
    status: "active", confirmedAt: {$lte: post.newsletter.startedAt},
    ...(post.newsletter.cursor ? {_id: {$gt: post.newsletter.cursor}} : {}),
  }, {sort: {_id: 1}});
  if (!subscriber) {
    await posts.updateOne(guard, {$set: {"newsletter.completedAt": now}, $unset: {"newsletter.lock": ""}});
    return {completed: true};
  }
  try {
    const article = localize(post, subscriber.language);
    const url = new URL(`/blog/${encodeURIComponent(article.slug)}`, origin);
    url.searchParams.set("lng", subscriber.language);
    const unsubscribeUrl = new URL("/newsletter", origin);
    unsubscribeUrl.searchParams.set("action", "unsubscribe");
    unsubscribeUrl.searchParams.set("token", subscriber.unsubscribeToken);
    unsubscribeUrl.searchParams.set("lng", subscriber.language);
    // Recheck consent and publication immediately before sending a private, individual email.
    const active = await subscribers.findOne({_id: subscriber._id, status: "active", confirmedAt: {$lte: post.newsletter.startedAt}});
    const published = await posts.findOne({_id: post._id, status: "published"});
    if (!published) {
      await posts.updateOne(guard, {$set: {"newsletter.availableAt": now}, $unset: {"newsletter.lock": ""}});
      return {paused: true};
    }
    if (active) {
      unsubscribeUrl.searchParams.set("token", active.unsubscribeToken);
      const result = await send({to: subscriber.email, ...newsletterMessage({language: subscriber.language, title: article.title, summary: article.summary, url: url.href, unsubscribeUrl: unsubscribeUrl.href})});
      if (!result.ok || result.rejected?.length) throw new Error("Newsletter delivery failed");
    }
    await posts.updateOne(guard, {$set: {"newsletter.cursor": subscriber._id, "newsletter.availableAt": now, "newsletter.attempts": 0}, $inc: {"newsletter.sent": active ? 1 : 0}, $unset: {"newsletter.lock": ""}});
    return {sent: Boolean(active)};
  } catch {
    const attempts = (post.newsletter.attemptSubscriber === subscriber._id ? post.newsletter.attempts || 0 : 0) + 1;
    // A bad mailbox must not block every remaining subscriber.
    if (attempts >= 5) {
      await db.collection("newsletter_failures").updateOne({_id: `${post._id}:${subscriber._id}`}, {$set: {postId: post._id, subscriberId: subscriber._id, failedAt: now}}, {upsert: true});
    }
    await posts.updateOne(guard, {$set: {
      "newsletter.availableAt": new Date(+now + 5 * 60000),
      "newsletter.attempts": attempts >= 5 ? 0 : attempts,
      "newsletter.attemptSubscriber": subscriber._id,
      ...(attempts >= 5 ? {"newsletter.cursor": subscriber._id} : {}),
    }, $unset: {"newsletter.lock": ""}});
    return {failed: true};
  }
}

export async function requestSubscription({db, send, origin, input, ip, now = new Date()}) {
  const email = normalizeEmail(input.email);
  if (!email || input.consent !== true) return {status: 400, error: "invalid"};

  const bucket = Math.floor(+now / 3600000);
  const rate = await db.collection("newsletter_rate_limits").findOneAndUpdate(
    {_id: hashToken(`${ip}:${bucket}`)},
    {$inc: {count: 1}, $setOnInsert: {expiresAt: new Date(+now + 2 * 3600000)}},
    {upsert: true, returnDocument: "after", includeResultMetadata: false},
  );
  if (rate.count > 10) return {status: 429, error: "rateLimit"};
  const subscribers = db.collection("newsletter_subscribers");
  const _id = hashToken(email);
  try {
    await subscribers.updateOne({_id}, {$setOnInsert: {email, status: "pending", createdAt: now, expiresAt: new Date(+now + 86400000)}}, {upsert: true});
  } catch (error) { if (error.code !== 11000) throw error; }
  const token = newToken();
  const language = input.language === "de" ? "de" : "en";
  const claimed = await subscribers.findOneAndUpdate({
    _id, status: {$ne: "active"},
    $or: [{requestedAt: {$exists: false}}, {requestedAt: {$lt: new Date(+now - 15 * 60000)}}],
  }, {$set: {status: "pending", language, confirmationHash: hashToken(token), requestedAt: now,
    consentVersion: "newsletter-v1", expiresAt: new Date(+now + 86400000), unsubscribeToken: newToken()}},
  {returnDocument: "after", includeResultMetadata: false});
  if (!claimed) return {status: 200};
  const url = new URL("/newsletter", origin);
  url.searchParams.set("action", "confirm");
  url.searchParams.set("token", token);
  url.searchParams.set("lng", language);
  try {
    const result = await send({to: email, ...newsletterMessage({language, url: url.href})});
    if (!result.ok || result.rejected?.length) throw new Error("Confirmation delivery failed");
  } catch {
    await subscribers.updateOne({_id, confirmationHash: hashToken(token)}, {$unset: {requestedAt: "", confirmationHash: ""}});
    return {status: 503, error: "unavailable"};
  }
  return {status: 200};
}
export async function changeSubscription({db, action, token, now = new Date()}) {
  if (!validToken(token)) return false;
  const subscribers = db.collection("newsletter_subscribers");
  if (action === "confirm") {
    const result = await subscribers.updateOne({confirmationHash: hashToken(token), status: "pending", expiresAt: {$gt: now}},
      {$set: {status: "active", confirmedAt: now}, $unset: {confirmationHash: "", expiresAt: ""}});
    return result.modifiedCount === 1;
  }
  if (action === "unsubscribe") {
    const result = await subscribers.updateOne({unsubscribeToken: token},
      {$set: {status: "unsubscribed", unsubscribedAt: now, expiresAt: new Date(+now + 30 * 86400000)}, $unset: {confirmationHash: ""}});
    return result.matchedCount === 1;
  }
  return false;
}