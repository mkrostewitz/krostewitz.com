"use client";

import {X} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import OutreachForm from "./OutreachForm";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";

export default function CreateLeadModal({saving, onSave, onClose}) {
  const dialog = useRef(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    element.querySelector("input")?.focus();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  async function save(patch) {
    setError("");
    const result = await onSave(patch);
    if (result?.error) setError(result.error);
  }

  return createPortal(
    <dialog ref={dialog} className={`${outreach.activityModal} ${outreach.createModal}`}
      aria-labelledby="create-lead-title"
      onCancel={(event) => {event.preventDefault(); if (!saving) onClose();}}>
      <div className={styles.leadModalHeader}>
        <h2 id="create-lead-title">Add new lead</h2>
        <button className={styles.iconButton} type="button" disabled={saving} aria-label="Close new lead" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      <OutreachForm saving={saving} onSave={save} onCancel={onClose} />
    </dialog>, document.body
  );
}
