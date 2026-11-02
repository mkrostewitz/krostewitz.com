"use client";

import {ArrowUp, ArrowDown, X} from "lucide-react";
import {categorySequenceRows} from "../../lib/apolloRouting.mjs";
import {normalizeLeadSource} from "../../lib/leadSource.mjs";
import ApolloOptionSelect from "./ApolloOptionSelect";
import {FormIconButton} from "../components/forms/FormFields";
import ui from "./integrations.module.css";

export default function ApolloSequenceRules({rules, categories, onChange, source = false}) {
  const rows = categorySequenceRows(categories, rules, source ? normalizeLeadSource : undefined);
  function update(category, sequenceId, option) {
    const index = rules.findIndex((rule) => rule.category.toLowerCase() === category.toLowerCase());
    if (!sequenceId) {onChange(rules.filter((_, i) => i !== index)); return;}
    const rule = {category, sequenceId, sequenceName: option?.label || ""};
    onChange(index < 0 ? [...rules, rule] : rules.map((item, i) => i === index ? rule : item));
  }
  function move(index, direction) {
    const next = [...rules];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  return <div className={ui.categoryRules}>
    <div><h3>{source ? "Sequence per source" : "Sequence per contact type"}</h3><p className={ui.hint}>{source ? "Match the lead’s Source field. Source rules take priority over contact-type rules." : "Choose a sequence for each contact type. Use the arrows to set priority when a lead has multiple types."}</p></div>
    {rows.map(({category, sequenceId, ruleIndex}) => <div className={ui.categoryRule} key={category.toLowerCase()}>
      <div className={ui.categoryName}><strong>{category}</strong><small>{ruleIndex >= 0 ? `Priority ${ruleIndex + 1}` : "Not assigned"}</small></div>
      <ApolloOptionSelect kind="sequences" label={`Sequence for ${category}`} required={false} emptyLabel="No assigned sequence" value={sequenceId}
        onChange={(id, option) => update(category, id, option)} />
      <div className={ui.ruleActions}>
        <FormIconButton disabled={ruleIndex <= 0} label={`Move ${category} up`} onClick={() => move(ruleIndex, -1)}><ArrowUp size={15} /></FormIconButton>
        <FormIconButton disabled={ruleIndex < 0 || ruleIndex === rules.length - 1} label={`Move ${category} down`} onClick={() => move(ruleIndex, 1)}><ArrowDown size={15} /></FormIconButton>
        <FormIconButton disabled={ruleIndex < 0} label={`Clear sequence for ${category}`} onClick={() => update(category, "")}><X size={15} /></FormIconButton>
      </div>
    </div>)}
    {!rows.length && <p className={ui.hint}>No choices found. Use Contact types & sources above to add them.</p>}
    <p className={ui.hint}>Default priority: explicit choice → source → contact type → fallback. Enrollment still requires an explicit action on the lead.</p>
  </div>;
}
