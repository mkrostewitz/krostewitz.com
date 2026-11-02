import test from "node:test";
import assert from "node:assert/strict";
import {apolloSettingsStatus, apolloSettingsPatch, encryptApolloKey, decryptApolloKey} from "./apolloSettingsCore.mjs";

const secret = "a".repeat(32);

test("Apollo requires explicit opt-in and a database credential", () => {
  for (const document of [null, {}, {enabled: false}, {enabled: "true"}]) {
    assert.equal(apolloSettingsStatus(document, "environment-secret").available, false);
  }
  assert.equal(apolloSettingsStatus({enabled: true}).available, false);
  assert.equal(apolloSettingsStatus({enabled: true}, "environment-secret").available, false);
  assert.equal(apolloSettingsStatus({enabled: true, apiKeyEncrypted: "encrypted"}).available, true);
});

test("status never exposes secrets and ignores environment keys", () => {
  const status = apolloSettingsStatus({enabled: true, apiKeyEncrypted: "private", arbitrary: "private"}, "private-env");
  assert.deepEqual(status, {enabled: true, configured: true, available: true, keySource: "saved", listId: "", listName: "website_leads", listEnabled: false, sequenceEnabled: false, sourceSequenceRules: [], sequenceRules: [], sequenceName: "", sequenceId: "", emailAccountId: ""});
  assert.equal(apolloSettingsStatus({apiKeyEncrypted: ""}, "env-key").keySource, null);
});

test("keys are encrypted with random IVs and tampering or wrong secrets fail", () => {
  const encrypted = encryptApolloKey("apollo-test-key", secret);
  assert.ok(!encrypted.includes("apollo-test-key"));
  assert.notEqual(encrypted, encryptApolloKey("apollo-test-key", secret));
  assert.equal(decryptApolloKey(encrypted, secret), "apollo-test-key");
  assert.throws(() => decryptApolloKey(encrypted, "b".repeat(32)));
  const parts = encrypted.split(":");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.throws(() => decryptApolloKey(parts.join(":"), secret));
  assert.throws(() => encryptApolloKey("test", "short"), /AUTH_SECRET/);
});

test("blank keys are preserved, removal is explicit, and disabling needs no encryption secret", () => {
  assert.deepEqual(apolloSettingsPatch({enabled: false, apiKey: " "}), {enabled: false});
  assert.deepEqual(apolloSettingsPatch({enabled: false, removeKey: true}), {enabled: false, apiKeyEncrypted: ""});
  assert.deepEqual(apolloSettingsPatch({enabled: true, removeKey: true}), {enabled: false, apiKeyEncrypted: ""});
  const patch = apolloSettingsPatch({enabled: true, apiKey: " new-key "}, secret);
  assert.equal(decryptApolloKey(patch.apiKeyEncrypted, secret), "new-key");
  assert.throws(() => apolloSettingsPatch({enabled: true, removeKey: true, apiKey: "test"}, secret));
  for (const input of [null, {}, {enabled: "true"}, {enabled: true, apiKey: 123}, {enabled: true, apiKey: "bad\nkey"}]) {
    assert.throws(() => apolloSettingsPatch(input, secret));
  }
});


test("manual sequence enrollment requires a list and sending account but no defaults", async () => {
  const {validateApolloEnrollmentSettings} = await import("./apolloSettingsCore.mjs");
  const settings = {sequenceEnabled: true, listEnabled: true, emailAccountId: "507f1f77bcf86cd799439013", sequenceId: "", sequenceRules: []};
  assert.doesNotThrow(() => validateApolloEnrollmentSettings(settings));
  assert.throws(() => validateApolloEnrollmentSettings({...settings, listEnabled: false}), /list action/);
  assert.throws(() => validateApolloEnrollmentSettings({...settings, emailAccountId: ""}), /sending account/);
  assert.doesNotThrow(() => validateApolloEnrollmentSettings({sequenceEnabled: false}));
});
