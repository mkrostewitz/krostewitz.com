"use client";

import {useEffect, useRef} from "react";
import {useFormikContext} from "formik";
import {useSnackbar} from "./SnackbarProvider";

export default function FormikErrorsSnackbar() {
  const {errors, submitCount, isValidating, isSubmitting} = useFormikContext();
  const {showSnackbar} = useSnackbar();
  const reported = useRef(0);
  useEffect(() => {
    if (!submitCount || isValidating || isSubmitting || reported.current === submitCount) return;
    reported.current = submitCount;
    const messages = Object.values(errors).filter((value) => typeof value === "string");
    if (messages.length) showSnackbar({type: "error", message: [...new Set(messages)].join("\n")});
  }, [errors, submitCount, isValidating, isSubmitting, showSnackbar]);
  return null;
}
