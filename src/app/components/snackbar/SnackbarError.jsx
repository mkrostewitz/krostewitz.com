"use client";

import {useEffect} from "react";
import {useSnackbar} from "./SnackbarProvider";

// Allows server-rendered pages to report failures through the same global UI.
export default function SnackbarError({message}) {
  const {showSnackbar} = useSnackbar();
  useEffect(() => {
    if (message) showSnackbar({type: "error", message});
  }, [message, showSnackbar]);
  return null;
}
