import {NextResponse} from "next/server";
import sanitizeHtml from "sanitize-html";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {getAiSettings} from "../../../../lib/aiSettings";
import {getCvDownloads} from "../../../../lib/cvFiles";
import {sanitizePostHtml} from "../../../../lib/posts";

export const runtime = "nodejs";

const SUPPORTED_LANGUAGES = {
  en: "English",
  de: "German",
};

const SUPPORTED_MODES = new Set(["create", "tweak", "translate"]);

const DEFAULT_TARGET_FIELDS = {
  title: true,
  summary: true,
  contentHtml: true,
};

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: {
      type: "string",
      description: "Plain text post title.",
    },
    summary: {
      type: "string",
      description: "Plain text summary for cards and metadata.",
    },
    contentHtml: {
      type: "string",
      description:
        "Safe rich-text HTML using article tags and tables, no markdown fences.",
    },
  },
  required: ["title", "summary", "contentHtml"],
};

function cleanText(value, maxLength = 2000) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function clampText(value, maxLength = 60000) {
  return String(value || "").slice(0, maxLength);
}

function getOpenAiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return {apiKey};
}

function getResponseText(data) {
  if (typeof data?.output_text === "string") return data.output_text;

  return (data?.output || [])
    .flatMap((item) => item.content || [])
    .map((content) => content.text || content.output_text || "")
    .join("")
    .trim();
}

function parseJsonPayload(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    if (!match) return null;
    return JSON.parse(match[0]);
  }
}

function normalizeMode(value) {
  const mode = String(value || "").toLowerCase();
  return SUPPORTED_MODES.has(mode) ? mode : "tweak";
}

function normalizeLanguage(value) {
  const language = String(value || "en").toLowerCase();
  return SUPPORTED_LANGUAGES[language] ? language : "en";
}

function normalizeTargetFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_TARGET_FIELDS;
  }

  return {
    title: value.title === true,
    summary: value.summary === true,
    contentHtml: value.contentHtml === true || value.content === true,
  };
}

function hasTargetField(targetFields) {
  return Object.values(targetFields).some(Boolean);
}

function getTargetFieldNames(targetFields) {
  return [
    targetFields.title ? "title" : "",
    targetFields.summary ? "summary" : "",
    targetFields.contentHtml ? "contentHtml" : "",
  ]
    .filter(Boolean)
    .join(", ");
}

function getRequestOrigin(request) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.AUTH_BASE_URL ||
    new URL(request.url).origin
  ).replace(/\/+$/, "");
}

function getAbsoluteUrl(url, origin) {
  const value = String(url || "").trim();
  if (!value) return "";

  try {
    return new URL(value, origin).toString();
  } catch {
    return "";
  }
}

function isOpenAiFetchableUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      ["http:", "https:"].includes(parsed.protocol) &&
      !["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname)
    );
  } catch {
    return false;
  }
}

async function getCvFileInputs(request) {
  const origin = getRequestOrigin(request);
  const downloads = await getCvDownloads();

  return Object.values(downloads)
    .map((asset) => ({
      type: "input_file",
      file_url: getAbsoluteUrl(asset.url, origin),
    }))
    .filter((asset) => isOpenAiFetchableUrl(asset.file_url));
}

function buildInstruction(mode, targetLanguage, agentInstructions) {
  const languageName = SUPPORTED_LANGUAGES[targetLanguage];
  const base = [
    "You are the content assistant configured by this site's saved AI settings.",
    "Follow the saved agent instructions as the source of truth for brand voice, audience, topics, and style.",
    "Preserve factual claims and numbers unless the user explicitly asks to change them.",
    "Use any attached CV files only as author/context grounding; do not quote from them unless relevant.",
    "Do not invent companies, metrics, dates, or outcomes.",
    "Return semantic article HTML only. Do not include inline styles, CSS, color attributes, emojis, markdown, or decorative formatting.",
    "Return only JSON that matches the requested schema.",
    agentInstructions,
  ].join(" ");

  if (mode === "create") {
    return `${base} Create a polished portfolio blog post in ${languageName}. Use clear executive language, concrete structure, and safe HTML. Use all supplied post fields as context, and only generate or rewrite the selected output fields.`;
  }

  if (mode === "translate") {
    return `${base} Translate the supplied post into ${languageName}. Preserve meaning, tone, formatting, links, and HTML structure. Use all supplied post fields as context, and only translate the selected output fields.`;
  }

  return `${base} Improve the supplied post in ${languageName}. Apply the user's instructions while preserving the author's voice, safe HTML, and article structure. Use all supplied post fields as context, and only rewrite the selected output fields.`;
}

async function createOpenAiResponse(apiKey, requestBody) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });
  const data = await response.json().catch(() => ({}));

  return {response, data};
}

async function runOpenAiPostEdit({
  mode,
  targetLanguage,
  prompt,
  post,
  targetFields,
  model,
  temperature,
  agentInstructions,
  cvFileInputs,
}) {
  const {apiKey} = getOpenAiConfig();
  const userContent = [
    {
      type: "input_text",
      text: JSON.stringify({
        mode,
        targetLanguage,
        targetLanguageName: SUPPORTED_LANGUAGES[targetLanguage],
        userInstructions: prompt,
        targetFields,
        selectedFields: getTargetFieldNames(targetFields),
        hasCvContext: cvFileInputs.length > 0,
        post,
        outputRules: [
          "Use all supplied post fields as context, including fields that are not selected.",
          "Only create or rewrite fields where targetFields is true.",
          "For fields where targetFields is false, copy the original supplied value unchanged.",
          "title and summary must be plain text.",
          "contentHtml must be valid article HTML.",
          "Allowed contentHtml tags: p, br, strong, em, u, s, h2, h3, h4, ul, ol, li, blockquote, a, code, pre, hr, table, tbody, thead, tfoot, tr, th, td, colgroup, col, div, span.",
          "Do not include scripts, inline event handlers, markdown, or code fences.",
        ],
      }),
    },
    ...cvFileInputs,
  ];
  const requestBody = {
    model,
    instructions: buildInstruction(mode, targetLanguage, agentInstructions),
    input: [
      {
        role: "user",
        content: userContent,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "post_content",
        strict: true,
        schema: OUTPUT_SCHEMA,
      },
    },
    max_output_tokens: 3000,
  };

  if (temperature !== null && temperature !== undefined) {
    requestBody.temperature = temperature;
  }

  let {response, data} = await createOpenAiResponse(apiKey, requestBody);

  if (
    !response.ok &&
    requestBody.temperature !== undefined &&
    String(data?.error?.message || "").toLowerCase().includes("temperature")
  ) {
    const retryBody = {...requestBody};
    delete retryBody.temperature;
    ({response, data} = await createOpenAiResponse(apiKey, retryBody));
  }

  if (!response.ok) {
    const message =
      data?.error?.message ||
      (response.status === 401
        ? "OpenAI API key was rejected."
        : "OpenAI request failed.");
    throw new Error(message);
  }

  const text = getResponseText(data);
  const parsed = parseJsonPayload(text);

  if (!parsed) {
    throw new Error("OpenAI returned an unreadable response.");
  }

  return {
    title: cleanText(parsed.title, 140),
    summary: cleanText(parsed.summary, 260),
    contentHtml: sanitizePostHtml(parsed.contentHtml),
  };
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const mode = normalizeMode(body.mode);
    const targetLanguage = normalizeLanguage(body.targetLanguage);
    const targetFields = normalizeTargetFields(body.targetFields);
    const prompt = clampText(body.prompt, 4000);
    const existingContent = cleanText(body.contentHtml, 100000);

    if (!hasTargetField(targetFields)) {
      return NextResponse.json(
        {error: "Select at least one field for the assistant to update."},
        {status: 400}
      );
    }

    if (mode === "create" && !prompt) {
      return NextResponse.json(
        {error: "Add a prompt for creating a post."},
        {status: 400}
      );
    }

    if (
      mode !== "create" &&
      !existingContent &&
      !cleanText(body.title, 200) &&
      !cleanText(body.summary, 260)
    ) {
      return NextResponse.json(
        {error: "Add a title, summary, or content before using this AI action."},
        {status: 400}
      );
    }

    const aiSettings = await getAiSettings();
    const cvFileInputs = aiSettings.includeCvContext
      ? await getCvFileInputs(request)
      : [];
    const post = await runOpenAiPostEdit({
      mode,
      targetLanguage,
      prompt,
      targetFields,
      model: aiSettings.model,
      temperature: aiSettings.temperature,
      agentInstructions: aiSettings.agentInstructions,
      cvFileInputs,
      post: {
        title: cleanText(body.title, 140),
        summary: cleanText(body.summary, 260),
        contentHtml: sanitizePostHtml(body.contentHtml),
      },
    });

    return NextResponse.json({post});
  } catch (error) {
    console.error("Post AI API error", error);
    return NextResponse.json(
      {error: error.message || "Unable to generate post content."},
      {status: error.message?.includes("OPENAI_API_KEY") ? 500 : 502}
    );
  }
}
