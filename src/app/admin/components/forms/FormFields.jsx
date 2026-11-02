"use client";

import {createContext, useContext, useEffect, useRef} from "react";
import {Autocomplete, Box, Button, CircularProgress, FormControlLabel, IconButton, Stack, Switch, TextField, Tooltip, Typography} from "@mui/material";

const DisabledContext = createContext(false);
export function FormScope({disabled = false, children}) {
  const inherited = useContext(DisabledContext);
  return <DisabledContext.Provider value={inherited || disabled}>{children}</DisabledContext.Provider>;
}
export function FormField({disabled = false, ...props}) {
  const inherited = useContext(DisabledContext);
  return <TextField {...props} disabled={inherited || disabled} />;
}
export function FormButton({disabled = false, busy = false, children, ...props}) {
  const inherited = useContext(DisabledContext);
  return <Button type="button" {...props} disabled={inherited || disabled || busy} startIcon={busy ? <CircularProgress size={16} color="inherit" /> : props.startIcon}>{children}</Button>;
}
export function FormIconButton({label, disabled = false, children, ...props}) {
  const inherited = useContext(DisabledContext);
  return <Tooltip title={label}><span><IconButton size="small" {...props} aria-label={label} disabled={inherited || disabled}>{children}</IconButton></span></Tooltip>;
}
export function FormToggle({label, description, disabled = false, ...props}) {
  const inherited = useContext(DisabledContext);
  return <FormControlLabel sx={{m: 0, alignItems: "flex-start", gap: 1, "& .MuiSwitch-root": {mt: -.5}}}
    control={<Switch size="small" {...props} disabled={inherited || disabled} />}
    label={<Box><Typography variant="body2" sx={{fontWeight: 600}}>{label}</Typography>{description && <Typography variant="caption" color="text.secondary" component="p" sx={{mt: .5}}>{description}</Typography>}</Box>} />;
}
export function FormSelect({label, value, options, onChange, required = false, busy = false, disabled = false, placeholder, helperText, error}) {
  const inherited = useContext(DisabledContext);
  const input = useRef(null);
  const selected = options.find((item) => item.value === value) || null;
  useEffect(() => {
    input.current?.setCustomValidity(required && !selected ? `Choose ${label.toLowerCase()} from the options.` : "");
  }, [required, selected, label]);
  return <Autocomplete fullWidth size="small" options={options} value={selected} loading={busy} disabled={inherited || disabled}
    disableClearable={required} getOptionLabel={(item) => item.label} getOptionDisabled={(item) => Boolean(item.disabled)}
    isOptionEqualToValue={(a, b) => a.value === b.value} onChange={(_, item) => onChange(item?.value || "")}
    renderOption={(props, item) => {
      const {key, ...rest} = props;
      return <li key={key} {...rest}><Stack><Typography variant="body2">{item.label}</Typography>{item.description && <Typography variant="caption" color="text.secondary">{item.description}</Typography>}</Stack></li>;
    }}
    renderInput={(params) => <TextField {...params} inputRef={input} label={label} placeholder={placeholder} required={required}
      error={Boolean(error)} helperText={error || helperText} slotProps={{...params.slotProps, input: {...params.slotProps.input,
        endAdornment: <>{busy && <CircularProgress color="inherit" size={16} />}{params.slotProps.input.endAdornment}</>}}} />} />;
}
