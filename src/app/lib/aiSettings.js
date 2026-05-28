import "server-only";

import sanitizeHtml from "sanitize-html";

import {getDb} from "./mongo";

const CONTENT_COLLECTION = "site_content";
const AI_SETTINGS_ID = "ai_settings";
const STARTER_MODEL = "gpt-5.5";
const STARTER_TEMPERATURE = 0.7;

export const AI_AGENT_INSTRUCTIONS_TEMPLATE = [
  "You are the content and brand assistant for [site name], the site of [owner name].",
  "",
  "Position the owner as [role, market, and area of expertise].",
  "",
  "Visual and editorial identity:",
  "- Describe the site's visual restraint, palette, and tone.",
  "- Explain which accents or formats should be used sparingly.",
  "- Call out anything that should feel off-brand.",
  "",
  "Writing style:",
  "- Define the voice, level of formality, and sentence style.",
  "- List preferred vocabulary and recurring business or domain language.",
  "- Use measurable outcomes only where facts are provided.",
  "- Do not invent companies, numbers, dates, markets, roles, or achievements.",
  "- Preserve existing factual claims unless explicitly asked to change them.",
  "",
  "Content themes:",
  "- List the domains, audiences, and topics this site should cover.",
  "- List topics or claims to avoid unless explicitly supplied.",
  "",
  "Avoid:",
  "- Generic marketing language.",
  "- Unsupported claims.",
  "- Decorative formatting that does not fit the site.",
  "",
  "When creating site copy, blog posts, summaries, CTAs, or section text, make the result feel native to the existing site.",
].join("\n");

export class AiSettingsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "AiSettingsError";
    this.status = status;
  }
}

function cleanSingleLine(value, maxLength = 120) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMultiline(value, maxLength = 6000) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .slice(0, maxLength);
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return defaultValue;
}

function normalizeTemperature(value, defaultValue = STARTER_TEMPERATURE) {
  if (value === "" || value === null) return null;
  if (value === undefined) return defaultValue;

  const temperature = Number(value);
  if (!Number.isFinite(temperature)) {
    throw new AiSettingsError("Temperature must be a number from 0 to 2.");
  }

  return Math.min(2, Math.max(0, temperature));
}

function normalizeAgentInstructions(value) {
  const instructions = cleanMultiline(value, 6000);

  return instructions || AI_AGENT_INSTRUCTIONS_TEMPLATE;
}

function getStarterModel() {
  return cleanSingleLine(
    process.env.OPENAI_POSTS_MODEL || process.env.OPENAI_MODEL || STARTER_MODEL,
    80
  );
}

function getStarterAiSettings() {
  return {
    model: getStarterModel(),
    temperature: STARTER_TEMPERATURE,
    agentInstructions: AI_AGENT_INSTRUCTIONS_TEMPLATE,
    includeCvContext: true,
  };
}

function toIsoDate(value) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function normalizeAiSettings(input = {}) {
  const model = cleanSingleLine(input.model || getStarterModel(), 80);

  if (!model) {
    throw new AiSettingsError("OpenAI model is required.");
  }

  return {
    model,
    temperature: normalizeTemperature(input.temperature),
    agentInstructions: normalizeAgentInstructions(input.agentInstructions),
    includeCvContext: normalizeBoolean(input.includeCvContext, true),
  };
}

function serializeAiSettings(document) {
  return {
    ...normalizeAiSettings(document || {}),
    updatedAt: toIsoDate(document?.updatedAt),
    updatedBy: document?.updatedBy || null,
  };
}

export async function getAiSettings() {
  const db = await getDb();
  const collection = db.collection(CONTENT_COLLECTION);
  let document = await collection.findOne({_id: AI_SETTINGS_ID});

  if (!document) {
    const now = new Date();

    await collection.updateOne(
      {_id: AI_SETTINGS_ID},
      {
        $setOnInsert: {
          ...getStarterAiSettings(),
          createdAt: now,
          updatedAt: now,
          updatedBy: null,
        },
      },
      {upsert: true}
    );

    document = await collection.findOne({_id: AI_SETTINGS_ID});
  } else {
    const patch = {};

    if (!document.model) patch.model = getStarterModel();
    if (document.temperature === undefined) {
      patch.temperature = STARTER_TEMPERATURE;
    }
    if (!document.agentInstructions) {
      patch.agentInstructions = AI_AGENT_INSTRUCTIONS_TEMPLATE;
    }
    if (document.includeCvContext === undefined) {
      patch.includeCvContext = true;
    }

    if (Object.keys(patch).length > 0) {
      const now = new Date();
      patch.updatedAt = document.updatedAt || now;
      patch.updatedBy = document.updatedBy || null;

      await collection.updateOne({_id: AI_SETTINGS_ID}, {$set: patch});
      document = {...document, ...patch};
    }
  }

  return serializeAiSettings(document);
}

export async function saveAiSettings(input = {}, user) {
  const settings = normalizeAiSettings(input);
  const now = new Date();
  const document = {
    ...settings,
    updatedAt: now,
    updatedBy: user?.email || null,
  };
  const db = await getDb();

  await db.collection(CONTENT_COLLECTION).updateOne(
    {_id: AI_SETTINGS_ID},
    {
      $set: document,
      $setOnInsert: {createdAt: now},
    },
    {upsert: true}
  );

  return serializeAiSettings(document);
}
