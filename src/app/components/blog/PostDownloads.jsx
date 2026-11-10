import {formatDocumentSize} from "../../lib/postAttachments.mjs";
import styles from "./post-downloads.module.css";

export default function PostDownloads({attachments = [], language = "en"}) {
  if (!attachments.length) return null;
  return (
    <section className={styles.downloads} aria-label={language === "de" ? "Dokumente herunterladen" : "Download documents"}>
      <h2>Downloads</h2>
      <ul>
        {attachments.map(item => (
          <li key={item.url}>
            <a href={item.url} download={item.fileName}>{item.fileName}</a>
            <span>{item.fileName.split(".").pop().toUpperCase()} · {formatDocumentSize(item.size)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
