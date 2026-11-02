import test from "node:test";
import assert from "node:assert/strict";
import {getApolloSender, apolloSenderStatus} from "./apolloSender.mjs";
const id = "507f1f77bcf86cd799439013";
const other = "507f1f77bcf86cd799439014";
const account = {id, email: "selected@example.com", active: true, revoked_at: null};
const mock = accounts => async () => ({ok: true, json: async () => ({email_accounts: accounts})});

test("uses exactly the configured mailbox even when another account is first/default", async () => {
  const sender = await getApolloSender({emailAccountId: id, fetchImpl: mock([{...account, id: other, email: "default@example.com"}, account])});
  assert.deepEqual(sender, {id, email: account.email});
});

test("missing, revoked and inactive mailboxes fail instead of falling back", async () => {
  for (const accounts of [[], [{...account, id: other}], [{...account, active: false}], [{...account, revoked_at: "2026-01-01"}]]) {
    await assert.rejects(getApolloSender({emailAccountId: id, fetchImpl: mock(accounts)}), /missing or disconnected/);
  }
});

test("verifies sender identity independently from successful enrollment", () => {
  const sender = {id, email: account.email};
  assert.equal(apolloSenderStatus({send_email_from_email_account_id: id}, sender), "verified");
  assert.equal(apolloSenderStatus({send_email_from_email_account_id: other}, sender), "mismatch");
  assert.equal(apolloSenderStatus({send_email_from_email_account_id: id, send_email_from_email_address: "wrong@example.com"}, sender), "mismatch");
  assert.equal(apolloSenderStatus({}, sender), "unknown");
});
