import {NextResponse} from "next/server";
import sanitizeHtml from "sanitize-html";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../lib/adminAuth";
import {sanitizePostHtml} from "../../../../lib/posts";

export const runtime = "nodejs";

const SUPPORTED_LANGUAGES = {
  en: "English",
  de: "German",
};

const SUPPORTED_MODES = new Set(["create", "tweak", "translate"]);

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
        "Safe rich-text HTML using only basic article tags, no markdown fences.",
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
  const model =
    process.env.OPENAI_POSTS_MODEL || process.env.OPENAI_MODEL || "gpt-5.5";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return {apiKey, model};
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

function buildInstruction(mode, targetLanguage) {
  const languageName = SUPPORTED_LANGUAGES[targetLanguage];
  const base =
    "You are an editorial assistant for Mathias Krostewitz, an operator and builder writing about growth, industrial technology, operations, and systems. Preserve factual claims and numbers unless the user explicitly asks to change them. Do not invent companies, metrics, dates, or outcomes. Return only JSON that matches the requested schema.";

  if (mode === "create") {
    return `${base} Create a polished portfolio blog post in ${languageName}. Use clear executive language, concrete structure, and safe HTML.`;
  }

  if (mode === "translate") {
    return `${base} Translate the supplied post into ${languageName}. Preserve meaning, tone, formatting, links, and HTML structure.`;
  }

  return `${base} Improve the supplied post in ${languageName}. Apply the user's instructions while preserving the author's voice, safe HTML, and article structure.`;
}

async function runOpenAiPostEdit({mode, targetLanguage, prompt, post}) {
  const {apiKey, model} = getOpenAiConfig();
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: buildInstruction(mode, targetLanguage),
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: JSON.stringify({
                mode,
                targetLanguage,
                targetLanguageName: SUPPORTED_LANGUAGES[targetLanguage],
                userInstructions: prompt,
                post,
                outputRules: [
                  "title and summary must be plain text.",
                  "contentHtml must be valid article HTML.",
                  "Allowed contentHtml tags: p, br, strong, em, u, s, h2, h3, h4, ul, ol, li, blockquote, a, code, pre, hr, div, span.",
                  "Do not include scripts, inline event handlers, markdown, or code fences.",
                ],
              }),
            },
          ],
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
    }),
  });
  const data = await response.json().catch(() => ({}));

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
    const prompt = clampText(body.prompt, 4000);
    const existingContent = cleanText(body.contentHtml, 100000);

    if (mode === "create" && !prompt) {
      return NextResponse.json(
        {error: "Add a prompt for creating a post."},
        {status: 400}
      );
    }

    if (mode !== "create" && !existingContent && !cleanText(body.title, 200)) {
      return NextResponse.json(
        {error: "Add post content before using this AI action."},
        {status: 400}
      );
    }

    const post = await runOpenAiPostEdit({
      mode,
      targetLanguage,
      prompt,
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
