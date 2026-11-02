"use client";

import {useMemo, useSyncExternalStore} from "react";
import {AppRouterCacheProvider} from "@mui/material-nextjs/v16-appRouter";
import {createTheme, ThemeProvider} from "@mui/material/styles";

function subscribe(listener) {
  const observer = new MutationObserver(listener);
  observer.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});
  return () => observer.disconnect();
}
const snapshot = () => document.documentElement.dataset.theme === "dark" ? "dark" : "light";

export default function AdminMuiProvider({children}) {
  const mode = useSyncExternalStore(subscribe, snapshot, () => "light");
  const theme = useMemo(() => createTheme({
    palette: {mode, primary: {main: mode === "dark" ? "#8ea2ff" : "#5773ff"},
      background: {default: mode === "dark" ? "#202632" : "#f6f7f9", paper: mode === "dark" ? "#171a22" : "#ffffff"}},
    typography: {fontFamily: '"Inter", "Helvetica Neue", system-ui, sans-serif', fontSize: 14,
      button: {textTransform: "none", fontWeight: 600}, h6: {fontSize: "1.05rem", fontWeight: 600}},
    shape: {borderRadius: 10},
    components: {
      MuiButton: {defaultProps: {disableElevation: true}, styleOverrides: {root: {minHeight: 40}}},
      MuiTextField: {defaultProps: {size: "small", variant: "outlined", fullWidth: true}},
      MuiOutlinedInput: {styleOverrides: {root: {minHeight: 44}}},
      MuiFormHelperText: {styleOverrides: {root: {marginLeft: 0, marginRight: 0}}},
      MuiDialog: {defaultProps: {fullWidth: true, maxWidth: "sm"}},
      MuiPaper: {styleOverrides: {root: {backgroundImage: "none"}}},
    },
  }), [mode]);
  return <AppRouterCacheProvider><ThemeProvider theme={theme}>{children}</ThemeProvider></AppRouterCacheProvider>;
}
