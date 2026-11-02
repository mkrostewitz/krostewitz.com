import { Stack } from "@mui/material";

// The surrounding LeadAccordion supplies the accessible summary button.
export default function DisclosureSummary({
  children
}) {
  return <Stack spacing={.5} sx={{
    "& small": {
      color: "text.secondary",
      fontSize: ".8rem"
    },
    "& strong": {
      fontWeight: 600
    }
  }}>{children}</Stack>;
}
