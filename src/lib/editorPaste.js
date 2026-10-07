import {Marked} from "marked";
import sanitizeHtml from "sanitize-html";

const markdown = new Marked({gfm: true, breaks: true});

export function shouldFormatClipboardText({text, html}) {
  if (!text) return false;
  // Keep formatting from documents/websites. Plain HTML clipboard wrappers
  // (for example, a copied Markdown source block) still need parsing.
  return !html || !/<(?:h[1-6]|strong|b|em|i|u|s|del|blockquote|ul|ol|table|a|img|figure)\b/i.test(html);
}

export function plainTextToArticleHtml(value, {extractTitle = false} = {}) {
  const source = String(value || "").replace(/\r\n?/g, "\n").trim();
  if (!source) return {html: "", title: ""};

  const tokens = markdown.lexer(source);
  let title = "";
  // Only an explicit top-level Markdown heading is a post title. Ordinary
  // short paragraphs must not silently become headings or disappear.
  if (extractTitle && tokens[0]?.type === "heading" && tokens[0].depth === 1) {
    title = sanitizeHtml(markdown.parseInline(tokens.shift().text), {
      allowedTags: [],
      allowedAttributes: {},
    });
  }

  const html = sanitizeHtml(markdown.parser(tokens), {
    allowedTags: [
      "p", "br", "h2", "h3", "h4", "strong", "em", "del", "s",
      "blockquote", "ul", "ol", "li", "a", "hr", "pre", "code",
      "table", "thead", "tbody", "tr", "th", "td",
    ],
    allowedAttributes: {a: ["href", "title"], ol: ["start"]},
    allowedSchemes: ["http", "https", "mailto", "tel"],
    transformTags: {h1: "h2", h5: "h4", h6: "h4"},
  });

  return {html, title};
}
