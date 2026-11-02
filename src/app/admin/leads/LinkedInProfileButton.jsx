"use client";

import { Box, SvgIcon } from "@mui/material";
import { LeadIconButton } from "./LeadUi";
import { linkedinProfileState } from "../../lib/linkedinProfile.mjs";

export default function LinkedInProfileButton({ value, label = "Open LinkedIn profile in a new tab" }) {
  const { url } = linkedinProfileState(value);
  return <Box component="span" sx={{ display: "inline-flex" }} onClick={event => event.stopPropagation()}>
    <LeadIconButton
          type="button"
          component={url ? "a" : "button"}
          href={url || undefined}
          target={url ? "_blank" : undefined}
          rel={url ? "noopener noreferrer" : undefined}
          disabled={!url}
          aria-label={label}
          sx={{ color: "#0a66c2", "&.Mui-disabled": { color: "action.disabled" } }}
        >
          <SvgIcon fontSize="small">
            <path d="M20.447 2H3.553C2.695 2 2 2.677 2 3.512v16.976C2 21.323 2.695 22 3.553 22h16.894C21.305 22 22 21.323 22 20.488V3.512C22 2.677 21.305 2 20.447 2ZM7.932 18.744H4.98V9.198h2.952v9.546ZM6.456 7.894a1.71 1.71 0 1 1 0-3.42 1.71 1.71 0 0 1 0 3.42Zm12.288 10.85h-2.95v-4.642c0-1.107-.02-2.53-1.542-2.53-1.543 0-1.78 1.205-1.78 2.45v4.722H9.52V9.198h2.833v1.304h.04c.394-.747 1.357-1.535 2.793-1.535 2.988 0 3.54 1.967 3.54 4.525v5.252Z" />
          </SvgIcon>
        </LeadIconButton>
  </Box>;
}
