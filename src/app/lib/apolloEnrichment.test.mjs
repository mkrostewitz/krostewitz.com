import test from "node:test";
import assert from "node:assert/strict";
import {apolloIdentity, apolloEnrichmentIssue, enrichWithApollo, parseApolloResult} from "./apolloEnrichment.mjs";
import {normalizeContact} from "./leadOutreach.mjs";

const contact = {firstName: "Max", lastName: "Mustermann", company: "Beispiel GmbH", linkedinUrl: "linkedin.com/in/max-muster?trk=example"};
const success = {match_confidence: "high", person: {name: "Max Mustermann", email: "max@example.com", email_status: "verified", organization: {name: "Beispiel GmbH"}}};

test("sends only identity fields and disables additional enrichment charges", async () => {
  let sent;
  const result = await enrichWithApollo({contact: {...contact, email: "old@example.com", phone: "12345", notes: "private"}, apiKey: "test-secret", fetchImpl: async (url, options) => {
    sent = JSON.parse(options.body);
    assert.equal(url, "https://api.apollo.io/api/v1/people/match");
    assert.equal(options.method, "POST");
    assert.equal(options.headers["X-Api-Key"], "test-secret");
    assert.equal(options.cache, "no-store");
    assert.ok(options.signal instanceof AbortSignal);
    return {ok: true, json: async () => success};
  }});
  assert.deepEqual(sent, {first_name: "Max", last_name: "Mustermann", organization_name: "Beispiel GmbH", linkedin_url: "https://www.linkedin.com/in/max-muster", reveal_personal_emails: false, reveal_phone_number: false, run_waterfall_email: false, run_waterfall_phone: false});
  assert.equal(result.email, "max@example.com");
  assert.equal(result.matchConfidence, "high");
  assert.equal(result.emailStatus, "verified");
  assert.equal(normalizeContact({...contact, email: result.email}).email, result.email);
});

test("requires enough valid identity and a key before making a paid request", async () => {
  const fetchImpl = async () => assert.fail("Must not call Apollo");
  for (const invalid of [undefined, null, {}, {firstName: "Max"}, {firstName: "Max", lastName: "Mustermann"}, {...contact, linkedinUrl: "https://example.com/in/max"}]) {
    await assert.rejects(enrichWithApollo({contact: invalid, apiKey: "test", fetchImpl}), {status: 400});
  }
  await assert.rejects(enrichWithApollo({contact, fetchImpl}), {status: 503});
  assert.deepEqual(apolloIdentity({linkedinUrl: "linkedin.com/in/max"}), {linkedin_url: "https://www.linkedin.com/in/max"});
  assert.deepEqual(apolloIdentity({...contact, linkedinUrl: ""}), {first_name: "Max", last_name: "Mustermann", organization_name: "Beispiel GmbH"});
});

test("distinguishes missing person, missing email and masked email without guessing", () => {
  assert.equal(parseApolloResult({person: null}).matched, false);
  assert.equal(parseApolloResult({...success, match_confidence: "none"}).matched, false);
  for (const email of [null, "", "not_an_email", "email_not_unlocked@domain.com", "m***@example.com"]) {
    const result = parseApolloResult({person: {...success.person, email}});
    assert.equal(result.matched, true);
    assert.equal(result.email, "");
  }
  for (const match_confidence of ["low", "medium", "high"]) {
    assert.equal(parseApolloResult({...success, match_confidence}).matchConfidence, match_confidence);
  }
  assert.equal(parseApolloResult({person: success.person}).matchConfidence, "unknown");
  assert.throws(() => parseApolloResult({error: "unexpected"}), /unreadable/);
});

test("provider errors are actionable without leaking response bodies or credentials", async () => {
  for (const [status, message] of [[400, /contact details/], [401, /API key/], [402, /credits/], [403, /access/], [429, /limit/], [500, /temporarily unavailable/]]) {
    await assert.rejects(enrichWithApollo({contact, apiKey: "test-secret", fetchImpl: async () => ({ok: false, status, json: async () => assert.fail("Must not forward provider error data")})}), message);
  }
  await assert.rejects(enrichWithApollo({contact, apiKey: "test", fetchImpl: async () => {throw new DOMException("secret", "TimeoutError");}}), /took too long/);
  await assert.rejects(enrichWithApollo({contact, apiKey: "test", fetchImpl: async () => {throw new Error("secret");}}), /Unable to reach Apollo/);
  await assert.rejects(enrichWithApollo({contact, apiKey: "test", fetchImpl: async () => ({ok: true, json: async () => {throw new Error("invalid JSON");}})}), /unreadable/);
});


test("enrichment readiness matches server validation and names missing fields", () => {
  assert.equal(apolloEnrichmentIssue({}), 'To enrich this contact, add a LinkedIn personal profile URL or complete: First name, Last name, Company.');
  assert.equal(apolloEnrichmentIssue({firstName: 'Max', lastName: '  ', company: 'Example'}), 'To enrich this contact, add a LinkedIn personal profile URL or complete: Last name.');
  for (const identity of [
    {firstName: 'Max', lastName: 'Mustermann', company: 'Example'},
    {linkedinUrl: 'linkedin.com/in/max'}
  ]) {
    assert.equal(apolloEnrichmentIssue(identity), '');
    assert.doesNotThrow(() => apolloIdentity(identity));
  }
  const invalid = {...contact, linkedinUrl: 'https://www.linkedin.com/company/example'};
  assert.match(apolloEnrichmentIssue(invalid), /personal profile URL/);
  assert.throws(() => apolloIdentity(invalid), {message: apolloEnrichmentIssue(invalid)});
});

test('photo enrichment is available without an email and ignores unsafe URLs', async () => {
  const photo = 'https://media.example.com/profile.jpg?signature=' + 'a'.repeat(2500);
  const result = await enrichWithApollo({contact, apiKey: 'test', fetchImpl: async () => ({ok: true,
    json: async () => ({person: {...success.person, email: null, photo_url: photo}})})});
  assert.equal(result.email, '');
  assert.equal(result.photoUrl, photo);
  assert.equal(normalizeContact({...contact, photoUrl: result.photoUrl}).photoUrl, photo);
  for (const photo_url of [undefined, '', 'javascript:alert(1)', 'data:image/png;base64,abc', 'http://example.com/photo.jpg', 'https://user:pass@example.com/photo.jpg', {}]) {
    assert.equal(parseApolloResult({person: {...success.person, photo_url}}).photoUrl, '');
  }
  assert.equal(parseApolloResult({match_confidence: 'none', person: {...success.person, photo_url: photo}}).photoUrl, undefined);
});
