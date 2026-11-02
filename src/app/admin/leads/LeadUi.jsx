"use client";

import { Children, createContext, useContext, useId, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Box, Button, Checkbox, FormControlLabel, IconButton, TextField, Tooltip } from "@mui/material";
import { ChevronDown } from "lucide-react";
const DisabledContext = createContext(false);
export const useLeadDisabled = () => useContext(DisabledContext);
export function LeadScope({
  disabled = false,
  children,
  ...props
}) {
  const inherited = useLeadDisabled();
  return <DisabledContext.Provider value={inherited || disabled}><Box {...props} sx={{
      display: "grid",
      gap: 2,
      minWidth: 0
    }}>{children}</Box></DisabledContext.Provider>;
}
export function LeadField({
  label,
  helperText,
  disabled,
  multiline,
  select,
  children,
  rows,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  className,
  sx,
  error,
  ...input
}) {
  const inherited = useLeadDisabled();
  const id = useId();
  return <TextField id={input.id || id} label={label} helperText={helperText} disabled={inherited || disabled} multiline={multiline} select={select} rows={rows} value={value} onChange={onChange} type={type} required={required} placeholder={placeholder} error={Boolean(error || input["aria-invalid"])} className={className} sx={sx} slotProps={{
    htmlInput: input,
    inputLabel: type === "date" ? {
      shrink: true
    } : undefined
  }}>{children}</TextField>;
}
export function LeadButton({
  disabled,
  children,
  variant = "outlined",
  ...props
}) {
  const inherited = useLeadDisabled();
  return <Button type="button" {...props} variant={props["aria-pressed"] ? "contained" : variant} disabled={inherited || disabled}>{children}</Button>;
}
export function LeadIconButton({
  disabled,
  children,
  title,
  ...props
}) {
  const inherited = useLeadDisabled();
  return <Tooltip title={title || props["aria-label"] || ""}><span><IconButton {...props} disabled={inherited || disabled} size="small">{children}</IconButton></span></Tooltip>;
}
export function LeadCheckbox({
  label,
  disabled,
  ...props
}) {
  const inherited = useLeadDisabled();
  return <FormControlLabel sx={{
    m: 0
  }} label={label} control={<Checkbox {...props} disabled={inherited || disabled} size="small" />} />;
}
export function LeadAccordion({
  children,
  open = false,
  ...props
}) {
  const [expanded, setExpanded] = useState(open);
  const id = useId();
  const [heading, ...body] = Children.toArray(children);
  return <Accordion {...props} expanded={expanded} onChange={(_, next) => setExpanded(next)} disableGutters elevation={0} onInvalidCapture={() => setExpanded(true)} sx={{
    border: 1,
    borderColor: "divider",
    borderRadius: "10px !important",
    "&:before": {
      display: "none"
    },
    minWidth: 0
  }}>
    <AccordionSummary id={`${id}-heading`} aria-controls={`${id}-content`} expandIcon={<ChevronDown size={18} />}>
      {heading}
    </AccordionSummary>
    <AccordionDetails id={`${id}-content`} sx={{
      display: "grid",
      gap: 2,
      minWidth: 0
    }}>{body}</AccordionDetails>
  </Accordion>;
}
