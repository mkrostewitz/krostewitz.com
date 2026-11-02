import test from "node:test";
import assert from "node:assert/strict";
import {getApolloLists, createApolloList} from "./apolloLists.mjs";
import {apolloSettingsPatch, apolloSettingsStatus} from "./apolloSettingsCore.mjs";
const id = "507f1f77bcf86cd799439011";

test("list discovery returns contact lists only, including legacy _id, without private metadata", async () => {
  const result = await getApolloLists({apiKey: "secret", fetchImpl: async (url, options) => {
    assert.equal(url, "https://api.apollo.io/api/v1/labels");
    assert.equal(options.method, "GET");
    return {ok: true, json: async () => [{_id: id, name: "Recruiters", modality: "contacts", cached_count: 3, team_id: "private"}, {id, name: "Companies", modality: "accounts"}]};
  }});
  assert.deepEqual(result, {options: [{id, label: "Recruiters", disabled: false, status: "3 contacts"}], nextPage: null});
});

test("creation uses a contact list and returns only selector metadata", async () => {
  const result = await createApolloList({name: " website_leads ", apiKey: "secret", fetchImpl: async (url, options) => {
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {name: "website_leads", modality: "contacts"});
    return {ok: true, json: async () => ({label: {id, name: "website_leads", modality: "contacts", cached_count: 0}})};
  }});
  assert.equal(result.id, id);
});

test("invalid names never call Apollo, and denied access identifies the capability", async () => {
  for (const name of [null, "", " ", "a\nb", "a".repeat(201)]) {
    await assert.rejects(createApolloList({name, fetchImpl: () => assert.fail("Must not call Apollo")}), {status: 400});
  }
  await assert.rejects(getApolloLists({fetchImpl: async () => ({ok: false, status: 403})}), /api\/v1\/labels\/index/);
  await assert.rejects(createApolloList({name: "Existing", fetchImpl: async () => ({ok: false, status: 422})}), /may already exist/);
  await assert.rejects(createApolloList({name: "New", fetchImpl: async () => ({ok: true, json: async () => ({})})}), /did not confirm/);
});

test("settings validate list IDs and never accept an unverified client list name", () => {
  assert.equal(apolloSettingsPatch({enabled: false, listId: id, listName: "spoofed"}).listName, undefined);
  assert.throws(() => apolloSettingsPatch({enabled: true, listId: "bad"}));
  assert.equal(apolloSettingsStatus({listId: id, listName: "Recruiters"}).listName, "Recruiters");
  assert.equal(apolloSettingsStatus({}).listName, "website_leads");
});
