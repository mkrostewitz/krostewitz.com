import {ChevronRight} from "lucide-react";
import styles from "./outreach.module.css";

export default function DisclosureSummary({children, className = ""}) {
  return (
    <summary className={`${styles.disclosureSummary} ${className}`}>
      <ChevronRight className={styles.disclosureChevron} size={18} strokeWidth={2}
        aria-hidden="true" focusable="false" />
      <span className={styles.disclosureLabel}>{children}</span>
    </summary>
  );
}
