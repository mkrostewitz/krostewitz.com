"use client";

import {useEffect, useId, useRef, useState} from "react";
import {Check, ChevronDown} from "lucide-react";
import ui from "./outlined-select.module.css";

export default function OutlinedSelect({label, value, options, onChange, required = false, busy = false, placeholder = "Choose an option"}) {
  const id = useId();
  const root = useRef(null);
  const trigger = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const search = useRef({text: "", time: 0});
  const choices = [{value: "", label: placeholder}, ...options];
  const selected = choices.find((item) => item.value === value);
  useEffect(() => {
    if (!open) return;
    const close = (event) => {if (!root.current?.contains(event.target)) setOpen(false);};
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  useEffect(() => {if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({block: "nearest"});}, [open, active, id]);
  function show() { setActive(Math.max(0, choices.findIndex((item) => item.value === value))); setOpen(true); }
  function choose(index) {
    const item = choices[index];
    if (!item || item.disabled) return;
    onChange(item.value);
    setInvalid(required && !item.value);
    setOpen(false);
    trigger.current?.focus();
  }
  function keyDown(event) {
    if (event.key === "Escape" && open) {event.preventDefault(); event.stopPropagation(); setOpen(false); return;}
    if (event.key === "Tab") {setOpen(false); return;}
    if (["Enter", " "].includes(event.key)) {event.preventDefault(); if (open) choose(active); else show(); return;}
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      if (!open) {show(); return;}
      const direction = event.key === "ArrowUp" || event.key === "End" ? -1 : 1;
      let index = event.key === "Home" ? -1 : event.key === "End" ? choices.length : active;
      for (let i = 0; i < choices.length; i++) {
        index = (index + direction + choices.length) % choices.length;
        if (!choices[index].disabled) {setActive(index); break;}
      }
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      search.current = {text: (Date.now() - search.current.time < 700 ? search.current.text : "") + event.key.toLowerCase(), time: Date.now()};
      const index = choices.findIndex((item) => !item.disabled && item.label.toLowerCase().startsWith(search.current.text));
      if (index >= 0) {setOpen(true); setActive(index);}
    }
  }
  return <div ref={root} className={ui.field} onBlur={(event) => {if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);}}>
    <span id={`${id}-label`} className={ui.label}>{label}{required && <span aria-hidden="true"> *</span>}</span>
    <button ref={trigger} type="button" role="combobox" className={ui.trigger} aria-labelledby={`${id}-label`}
      aria-expanded={open} aria-controls={`${id}-list`} aria-haspopup="listbox" aria-required={required} aria-invalid={invalid || undefined} aria-busy={busy}
      aria-activedescendant={open ? `${id}-${active}` : undefined} onKeyDown={keyDown} onClick={() => open ? setOpen(false) : show()}>
      <span className={!value ? ui.placeholder : undefined}>{selected?.label || "Saved selection"}</span>
      <ChevronDown size={18} aria-hidden="true" />
    </button>
    <select className={ui.validation} tabIndex={-1} aria-hidden="true" value={value} required={required}
      onChange={(event) => onChange(event.target.value)} onInvalid={(event) => {event.preventDefault(); setInvalid(true); trigger.current?.focus(); show();}}>
      {choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    {open && <ul id={`${id}-list`} role="listbox" aria-labelledby={`${id}-label`} className={ui.menu}>
      {choices.map((item, index) => <li key={item.value} id={`${id}-${index}`} role="option" aria-selected={value === item.value} aria-disabled={item.disabled || undefined}
        className={`${ui.option} ${active === index ? ui.active : ""}`} onMouseDown={(event) => event.preventDefault()}
        onMouseMove={() => {if (!item.disabled) setActive(index);}} onClick={() => choose(index)}>
        <span><span className={!item.value ? ui.placeholder : undefined}>{item.label}</span>{item.description && <small>{item.description}</small>}</span>
        {value === item.value && <Check size={16} aria-hidden="true" />}
      </li>)}
    </ul>}
    {invalid && <small className={ui.error}>Choose {label.toLowerCase()}.</small>}
  </div>;
}
