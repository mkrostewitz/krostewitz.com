"use client";

import {useEffect, useId, useRef, useState} from "react";
import {ChevronDown, X} from "lucide-react";
import styles from "./outreach.module.css";

const labelKey = (value) => value.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();

export default function LeadTagsAutocomplete({label, value, options, onChange, allowCreate = false, disabled = false, help}) {
  const id = useId();
  const input = useRef(null);
  const list = useRef(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const text = query.normalize("NFKC").replace(/\s+/g, " ").trim();
  const selected = new Set(value.map(labelKey));
  const choices = [...new Map(options.map((option) => [labelKey(option), option])).values()]
    .filter((option) => !selected.has(labelKey(option)) && labelKey(option).includes(labelKey(query)))
    .map((option) => ({label: option, create: false}));
  if (allowCreate && text && !selected.has(labelKey(text)) && !options.some((option) => labelKey(option) === labelKey(text))) {
    choices.push({label: text, create: true});
  }
  const expanded = open && !disabled;
  const activeIndex = active >= 0 && active < choices.length ? active : -1;

  useEffect(() => {
    if (expanded && activeIndex >= 0) list.current?.children[activeIndex]?.scrollIntoView({block: "nearest"});
  }, [activeIndex, expanded]);

  function add(tag) {
    if (disabled || (allowCreate && value.length >= 50)) return;
    const canonical = options.find((option) => labelKey(option) === labelKey(tag)) || tag;
    if (!selected.has(labelKey(canonical))) onChange([...value, canonical]);
    setQuery("");
    setActive(-1);
  }

  function remove(tag) {
    onChange(value.filter((item) => item !== tag));
    input.current?.focus();
  }

  return (
    <div className={styles.tagAutocomplete} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) {
        if (allowCreate && text) add(text);
        setOpen(false);
        setActive(-1);
      }
    }}>
      <label htmlFor={id}>{label}</label>
      <div className={styles.tagControl} data-disabled={disabled || undefined}>
        {value.map((tag) => <span className={styles.tagChip} key={tag}>
          {tag}<button type="button" disabled={disabled} aria-label={`Remove ${tag}`} onClick={() => remove(tag)}><X size={14} aria-hidden="true" /></button>
        </span>)}
        <input ref={input} id={id} role="combobox" autoComplete="off" disabled={disabled}
          aria-autocomplete="list" aria-expanded={expanded} aria-controls={expanded ? `${id}-options` : undefined}
          aria-activedescendant={expanded && activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
          aria-describedby={help ? `${id}-help` : undefined}
          maxLength={100} placeholder={value.length ? "Add tag…" : allowCreate ? "Select or create tags…" : "All tags"}
          value={query} onFocus={() => setOpen(true)}
          onChange={(event) => {setQuery(event.target.value); setActive(-1); setOpen(true);}}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive(choices.length ? (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length : -1);
            } else if (event.key === "Enter") {
              event.preventDefault();
              const choice = expanded && activeIndex >= 0 ? choices[activeIndex] : null;
              if (choice) add(choice.label);
              else if (allowCreate && text) add(text);
              setOpen(true);
            } else if (event.key === "Escape" && expanded) {
              event.preventDefault(); event.stopPropagation(); setOpen(false); setActive(-1);
            } else if (event.key === "Backspace" && !query && value.length) {
              onChange(value.slice(0, -1));
            }
          }} />
        {value.length > 0 && <button type="button" disabled={disabled} className={styles.tagIcon} aria-label={`Clear ${label.toLowerCase()}`} onClick={() => {onChange([]); setQuery(""); input.current?.focus();}}><X size={16} aria-hidden="true" /></button>}
        <button type="button" disabled={disabled} className={styles.tagIcon} aria-label={`${expanded ? "Hide" : "Show"} ${label.toLowerCase()} options`}
          onClick={() => {input.current?.focus(); setOpen(!expanded);}}><ChevronDown size={16} aria-hidden="true" /></button>
      </div>
      {expanded && <ul ref={list} id={`${id}-options`} role="listbox" aria-label={label} aria-multiselectable="true" className={styles.tagOptions}>
        {choices.map((choice, index) => <li key={choice.label} id={`${id}-option-${index}`} role="option" aria-selected={false}
          data-active={activeIndex === index || undefined} onMouseEnter={() => setActive(index)}
          onMouseDown={(event) => event.preventDefault()} onClick={() => {add(choice.label); input.current?.focus();}}>
          {choice.create ? `Add “${choice.label}”` : choice.label}
        </li>)}
        {!choices.length && <li role="presentation" className={styles.tagEmpty}>{allowCreate ? "Type a new tag to add it" : "No matching tags"}</li>}
      </ul>}
      {help && <small id={`${id}-help`} className={styles.tagHelp}>{help}</small>}
    </div>
  );
}
