import test from "node:test";
import assert from "node:assert/strict";
import {normalizeResearch, parseResearchResponse, researchContact, researchIdentity, researchFactSections} from "./contactResearch.mjs";
import {normalizeContact} from "./leadOutreach.mjs";

const contact = {firstName: "Ada", lastName: "Example", company: "Example Ltd"};
const completed = {
  status: "completed",
  output: [
    {type: "web_search_call", status: "completed"},
    {type: "message", content: [{type: "output_text", text: "Works at Example [source].", annotations: [{type: "url_citation", start_index: 17, end_index: 25, url: "https://example.com/team", title: "Team"}]}]},
  ],
};

test("only professional identity fields are sent to research", async () => {
  let sent;
  const result = await researchContact({contact: {...contact, email: "private@example.com", phone: "12345", notes: "private note", address: {street: "private"}}, model: "configured-model", apiKey: "test", fetchImpl: async (_url, options) => {
    sent = JSON.parse(options.body);
    return {ok: true, json: async () => completed};
  }});
  assert.deepEqual(JSON.parse(sent.input).contact, researchIdentity(contact));
  assert.equal(sent.model, "configured-model");
  assert.equal(sent.store, false);
  assert.equal(sent.tool_choice, "required");
  assert.deepEqual(sent.tools, [{type: "web_search"}]);
  assert.equal(result.citations[0].url, "https://example.com/team");
});

test("requires identity context before making a paid API call", async () => {
  let called = false;
  await assert.rejects(researchContact({contact: {firstName: "Ada"}, fetchImpl: async () => {called = true;}}), /company or profile/);
  assert.equal(called, false);
});

test("rejects incomplete, unsearched, empty and failed research", async () => {
  assert.throws(() => parseResearchResponse({...completed, status: "incomplete"}, contact), /did not finish/);
  assert.throws(() => parseResearchResponse({...completed, output: completed.output.slice(1)}, contact), /did not finish/);
  assert.throws(() => parseResearchResponse({...completed, output: completed.output.slice(0, 1)}, contact), /no readable/);
  await assert.rejects(researchContact({contact, fetchImpl: async () => ({ok: false, status: 429})}), /quota/);
});

test("citations retain offsets across output blocks and discard unsafe links", () => {
  const data = structuredClone(completed);
  data.output.push({type: "message", content: [{type: "output_text", text: "More [link]", annotations: [{type: "url_citation", start_index: 5, end_index: 11, url: "https://example.com/more"}]}]});
  const result = parseResearchResponse(data, contact);
  assert.equal(result.text.slice(result.citations[1].start, result.citations[1].end), "[link]");
  const unsafe = normalizeResearch({...result, citations: [
    {start: 0, end: 3, url: "javascript:alert(1)"},
    {start: 0, end: 3, url: "https://user:password@example.com"},
    {start: -1, end: 99999, url: "https://example.com"},
    null,
  ]});
  assert.deepEqual(unsafe.citations, []);
});

test("research survives contact normalization; older updates do not clear it", () => {
  const research = parseResearchResponse(completed, contact);
  assert.deepEqual(normalizeContact({...contact, research}).research, research);
  assert.equal(Object.hasOwn(normalizeContact(contact), "research"), false);
  assert.equal(normalizeContact({...contact, research: null}).research, null);
});

test("fact rows keep citation ranges and legacy reports remain readable", () => {
  const text = "Company\r\nName: Example [source]\r\nRevenue 2026: Not found\r\n\r\nPerson\r\nCurrent position: Director [source]\r\nExperience: Not verified";
  const sections = researchFactSections(text);
  assert.deepEqual(sections.map((section) => section.title), ["Company", "Person"]);
  const fact = sections[1].facts[0];
  assert.equal(fact.label, "Current position");
  assert.equal(text.slice(fact.start, fact.end).trim(), "Director [source]");
  assert.equal(researchFactSections("Identity match\nA long previous report."), null);
  assert.equal(researchFactSections("Company\nName: Example\nUnexpected paragraph\nPerson\nExperience: Unknown"), null);
});

test("revenue research uses explicit current and prior years in Berlin time", async () => {
  let sent;
  await researchContact({contact, model: "configured-model", apiKey: "test", now: new Date("2026-12-31T23:30:00Z"), fetchImpl: async (_url, options) => {
    sent = JSON.parse(options.body);
    return {ok: true, json: async () => completed};
  }});
  assert.match(sent.instructions, /Current reporting year: 2027; previous year: 2026/);
  assert.match(sent.instructions, /Do not use forecasts as actual revenue/);
  assert.match(sent.instructions, /Press releases must mention the person/);
});

test('research receives saved category labels and instructions to reuse equivalents', async () => {
  const categories = {industries: ['Industrial automation'], products: ['Sensors and controls', 'Automation systems']};
  let sent;
  await researchContact({contact, categories, model: 'configured-model', apiKey: 'test', fetchImpl: async (_url, options) => {
    sent = JSON.parse(options.body);
    return {ok: true, json: async () => completed};
  }});
  assert.deepEqual(JSON.parse(sent.input).categoryCatalog, categories);
  assert.match(sent.instructions, /reuse its exact spelling/);
  assert.match(sent.instructions, /Do not conflate merely related concepts/);
});
