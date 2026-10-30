"use client";

import {X} from "lucide-react";
import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import OutreachForm from "./OutreachForm";
import styles from "../admin.module.css";
import outreach from "./outreach.module.css";

export default function CreateLeadModal({saving, onSave, onClose, companyNames, leadTypes}) {
  const dialog = useRef(null);
  const [footerTarget, setFooterTarget] = useState(null);

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

  return createPortal(
    <dialog ref={dialog} className={`${outreach.activityModal} ${outreach.createModal}`}
      aria-labelledby="create-lead-title"
      onCancel={(event) => {event.preventDefault(); if (!saving) onClose();}}>
      <div className={outreach.createHeader}>
        <div><h2 id="create-lead-title">Add new lead</h2><p>Start with a contact. Add the context as you go.</p></div>
        <button className={styles.iconButton} type="button" disabled={saving} aria-label="Close new lead" onClick={onClose}>
          <X aria-hidden="true" size={18} />
        </button>
      </div>
      <div className={outreach.createBody}>
      <OutreachForm footerTarget={footerTarget} leadTypes={leadTypes} companyNames={companyNames} saving={saving} onSave={onSave} onCancel={onClose} />
      </div>
      <div className={outreach.createFooter} ref={setFooterTarget} />
    </dialog>, document.body
  );
}
