import {NextResponse} from "next/server";
import sanitizeHtml from "sanitize-html";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../../../../lib/adminAuth";
import {getAiSettings} from "../../../../../../lib/aiSettings";
import {getAdminPostById} from "../../../../../../lib/posts";
import {
  getSiteLanguageLabel,
  getSupportedSiteLanguage,
  SITE_LANGUAGE_CODES,
} from "../../../../../../../lib/siteLanguages";

export const runtime = "nodejs";

const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    thoughts: {
      type: "string",
      description:
        "LinkedIn-ready commentary only. No blog URL. Plain text with natural line breaks, emojis, and hashtags allowed.",
    },
  },
  required: ["thoughts"],
};

const LINKEDIN_STYLE_RULES = [
  "Write like a LinkedIn personal-profile post, not a blog summary.",
  "Open with a specific hook or point of view instead of repeating the title.",
  "Use 2 to 4 short paragraphs separated by blank lines.",
  "Include 1 to 3 relevant emojis where they add tone or scanning value.",
  "End with 2 to 4 relevant hashtags on the final line.",
  "Keep the tone professional, concrete, and human.",
  "Avoid clickbait, sales language, generic inspiration, and unsupported claims.",
];

function cleanText(value, maxLength = 3000) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanLinkedInThoughts(value, maxLength = 2800) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, maxLength);
}

function stripHtml(value, maxLength = 5000) {
  return sanitizeHtml(String(value || ""), {
    allowedTags: [],
    allowedAttributes: {},
  })
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
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
    .map((content) => content.text || content.output_text || content.refusal || "")
    .join("")
    .trim();
}

function parseJsonPayload(text) {
  const value = String(text || "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(value);
  } catch {
    const match = value.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function normalizeLanguage(value) {
  return getSupportedSiteLanguage(value) || SITE_LANGUAGE_CODES[0] || "en";
}

function getTranslation(post, language) {
  const translations = post?.translations || {};
  const requested = translations[language];
  const fallback = translations[SITE_LANGUAGE_CODES[0]] || {};

  return {
    title: requested?.title || fallback.title || post?.title || "",
    summary: requested?.summary || fallback.summary || post?.summary || "",
    contentHtml:
      requested?.contentHtml || fallback.contentHtml || post?.contentHtml || "",
  };
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

async function generateLinkedInThoughts({
  agentInstructions,
  currentThoughts,
  language,
  model,
  post,
  temperature,
}) {
  const {apiKey} = getOpenAiConfig();
  const languageName = getSiteLanguageLabel(language);
  const translation = getTranslation(post, language);
  const requestBody = {
    model,
    instructions: [
      "You write LinkedIn commentary for a personal professional profile.",
      "Follow the saved agent instructions for voice, audience, and positioning.",
      "Use the supplied blog post as the only factual source.",
      "Do not invent metrics, dates, companies, outcomes, or claims.",
      "Write in the requested language.",
      "Return only JSON matching the schema.",
      "The thoughts field must be plain text suitable for LinkedIn.",
      "Do not include the blog URL; the app appends it automatically.",
      ...LINKEDIN_STYLE_RULES,
      "If current thoughts are supplied, preserve the user's intent and improve them into a LinkedIn-ready draft.",
      agentInstructions,
    ].join(" "),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              targetLanguage: language,
              targetLanguageName: languageName,
              currentThoughts: cleanText(currentThoughts, 2800),
              post: {
                title: cleanText(translation.title, 180),
                summary: cleanText(translation.summary, 800),
                content: stripHtml(translation.contentHtml, 5000),
              },
              outputRules: [
                ...LINKEDIN_STYLE_RULES,
                "Make a specific observation or point of view from the post.",
                "Use the requested language for the post body.",
                "Hashtags may use common English industry terms when they are more recognizable.",
                "Target 450 to 900 characters unless the current thoughts require a little more.",
                "No markdown, no HTML, no URL.",
              ],
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "linkedin_thoughts",
        strict: true,
        schema: OUTPUT_SCHEMA,
      },
    },
    max_output_tokens: 900,
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

  if (!text) {
    throw new Error("OpenAI returned no readable text.");
  }

  const parsed = parseJsonPayload(text);
  const thoughts = cleanLinkedInThoughts(parsed?.thoughts, 2800);

  if (!thoughts) {
    throw new Error("OpenAI returned no usable thoughts.");
  }

  return thoughts;
}

export async function POST(request, context) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const {postId} = await context.params;
    const body = await request.json().catch(() => ({}));
    const post = await getAdminPostById(postId);

    if (!post) {
      return NextResponse.json({error: "Post not found."}, {status: 404});
    }

    const aiSettings = await getAiSettings();
    const thoughts = await generateLinkedInThoughts({
      agentInstructions: aiSettings.agentInstructions,
      currentThoughts: body.currentThoughts,
      language: normalizeLanguage(body.language),
      model: aiSettings.model,
      post,
      temperature: aiSettings.temperature,
    });

    return NextResponse.json({thoughts});
  } catch (error) {
    console.error("LinkedIn thoughts AI API error", error);
    return NextResponse.json(
      {error: error.message || "Unable to generate LinkedIn thoughts."},
      {status: error.message?.includes("OPENAI_API_KEY") ? 500 : 502},
    );
  }
}
