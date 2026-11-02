import {normalizeLeadSource} from "./leadSource.mjs";
import {normalizeLeadType, normalizeLeadTypes} from "./leadTypes.mjs";

export function normalizeSequenceRules(value, normalize = normalizeLeadType) {
  if (!Array.isArray(value) || value.length > 50) throw new Error("Choose up to 50 category sequence rules.");
  const seen = new Set();
  return value.map((rule) => {
    const category = normalize(rule?.category);
    if (!category || seen.has(category.toLowerCase())) throw new Error("Each sequence rule needs a unique lead category.");
    seen.add(category.toLowerCase());
    if (typeof rule.sequenceId !== "string" || !/^[a-f0-9]{24}$/i.test(rule.sequenceId)) throw new Error("Choose a sequence for every category rule.");
    return {category, sequenceId: rule.sequenceId, sequenceName: typeof rule.sequenceName === "string" ? rule.sequenceName.trim().slice(0, 200) : ""};
  });
}

export const normalizeSourceSequenceRules = value => normalizeSequenceRules(value, normalizeLeadSource);

export function normalizeApolloSequenceId(value) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || !/^[a-f0-9]{24}$/i.test(value)) throw new Error("Choose a valid Apollo sequence.");
  return value;
}

export function resolveApolloSequence(settings, categories = [], sequenceId = "", source = "") {
  const customId = normalizeApolloSequenceId(sequenceId);
  if (customId) return {sequenceId: customId, sequenceName: customId, category: null};
  const sourceKey = normalizeLeadSource(source || "").toLowerCase();
  const sourceRule = (settings.sourceSequenceRules || []).find(item => item.category.toLowerCase() === sourceKey);
  if (sourceRule) return {sequenceId: sourceRule.sequenceId, sequenceName: sourceRule.sequenceName || sourceRule.sequenceId, category: sourceRule.category};
  const tags = new Set(normalizeLeadTypes(categories).map((tag) => tag.toLowerCase()));
  const rule = (settings.sequenceRules || []).find((item) => tags.has(item.category.toLowerCase()));
  if (rule) return {sequenceId: rule.sequenceId, sequenceName: rule.sequenceName || rule.sequenceId, category: rule.category};
  return settings.sequenceId ? {sequenceId: settings.sequenceId, sequenceName: settings.sequenceName || settings.sequenceId, category: null} : null;
}

export function apolloLeadLabels(categories = []) {
  return normalizeLeadTypes(categories).filter((tag) => tag.toLowerCase() !== "website_leads");
}

// Show every known category, preserving assigned-rule priority and independent selections.
export function categorySequenceRows(categories, rules = [], normalize = normalizeLeadType) {
  const rows = new Map();
  rules.forEach((rule, ruleIndex) => {
    const category = normalize(rule.category);
    rows.set(category.toLowerCase(), {...rule, category, ruleIndex});
  });
  for (const value of categories) {
    const category = normalize(value);
    if (category && !rows.has(category.toLowerCase())) rows.set(category.toLowerCase(), {category, sequenceId: "", sequenceName: "", ruleIndex: -1});
  }
  return [...rows.values()];
}

// Restore a confirmed choice without treating it as a new enrollment request.
export function savedApolloSequence(apollo) {
  const sequences = apollo?.progress?.sequences || [];
  const attempt = apollo?.lastEnrollment;
  const confirmed = ["enrolled", "already_enrolled"].includes(attempt?.status);
  const previous = confirmed ? sequences.find(item => item.id === attempt.sequenceId) : null;
  const current = previous || (sequences.length === 1 ? sequences[0] : null);
  if (current) return {id: current.id, label: current.name || current.id};
  // Before the first remote read, use the durable enrollment confirmation.
  if (confirmed && !apollo?.progress?.membershipsKnown) return {id: attempt.sequenceId, label: attempt.sequenceId};
  return null;
}
