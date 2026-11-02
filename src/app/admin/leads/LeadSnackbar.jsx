"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Alert, Snackbar } from "@mui/material";
const SnackbarContext = createContext(null);
export const useSnackbar = () => useContext(SnackbarContext);
export default function LeadSnackbarProvider({
  children
}) {
  const [notice, setNotice] = useState(null);
  const closeSnackbar = useCallback(() => setNotice(null), []);
  const showSnackbar = useCallback((value) => setNotice({...value, key: Date.now()}), []);
  const context = useMemo(() => ({showSnackbar, closeSnackbar}), [showSnackbar, closeSnackbar]);
  const close = (_, reason) => {if (reason !== "clickaway") closeSnackbar();};
  return <SnackbarContext.Provider value={context}>
    {children}
    <Snackbar key={notice?.key} open={Boolean(notice)} autoHideDuration={notice?.type === "error" ? 10000 : 6000} anchorOrigin={{
      vertical: "bottom",
      horizontal: "center"
    }} onClose={close}>
      <Alert severity={notice?.type || "info"} variant="filled" onClose={close} sx={{
        whiteSpace: "pre-line",
        maxWidth: 600
      }}>{notice?.message}</Alert>
    </Snackbar>
  </SnackbarContext.Provider>;
}
