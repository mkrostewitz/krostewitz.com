import styles from "./loading-spinner.module.css";

export default function LoadingSpinner({
  className = "",
  hideLabel = false,
  label = "Loading",
  size = "medium",
  variant = "inline",
}) {
  const rootClassName = [
    styles.root,
    styles[variant] || "",
    styles[size] || "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={rootClassName} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      {label ? (
        <span className={hideLabel ? styles.visuallyHidden : styles.label}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
