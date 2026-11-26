"use client";

import {downloadWithExistingAccess} from "../../lib/downloadAccessClient.mjs";
import {useState} from "react";
import LeadCaptureModal from "../contact/LeadCaptureModal";
import {formatDocumentSize} from "../../lib/postAttachments.mjs";
import styles from "./post-downloads.module.css";

export default function PostDownloads({attachments = [], language = "en", postSlug, preview = false}) {
  const [selected, setSelected] = useState(null);
  if (!attachments.length) return null;
  return (
    <section className={styles.downloads} aria-label={language === "de" ? "Dokumente herunterladen" : "Download documents"}>
      <h2>Downloads</h2>
      <ul>
        {attachments.map(item => (
          <li key={item.key || item.fileName}>
            <button type="button" onClick={async () => {
              if (!await downloadWithExistingAccess("/api/attachments/download", {postSlug, attachmentKey: item.key || item.fileName})) setSelected(item);
            }} disabled={preview}>{item.fileName}</button>
            <span>{item.fileName.split(".").pop().toUpperCase()} · {formatDocumentSize(item.size)}</span>
          </li>
        ))}
      </ul>
      {selected && <LeadCaptureModal attachment={selected} postSlug={postSlug} cvLanguage={language} isOpen onClose={() => setSelected(null)} sourceType="attachment_download" />}
    </section>
  );
}
