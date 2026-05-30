"use client";

import {useMemo} from "react";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import styles from "./blog-post.module.css";

export default function ShareButtons({title, summary, url}) {
  const {showSnackbar} = useSnackbar();

  const links = useMemo(() => {
    const encodedUrl = encodeURIComponent(url);
    const encodedTitle = encodeURIComponent(title || "");
    const encodedSummary = encodeURIComponent(summary || title || "");

    return [
      {
        label: "LinkedIn",
        href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      },
      {
        label: "X",
        href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      },
      {
        label: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      },
      {
        label: "WhatsApp",
        href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      },
      {
        label: "Email",
        href: `mailto:?subject=${encodedTitle}&body=${encodedSummary}%0A%0A${encodedUrl}`,
      },
    ];
  }, [summary, title, url]);

  async function copyLink() {
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      showSnackbar({type: "success", message: "Link copied."});
    } catch {
      showSnackbar({type: "error", message: "Copy failed."});
    }
  }

  return (
    <div className={styles.shareBar} aria-label="Share this post">
      <span>Share</span>
      <div className={styles.shareButtons}>
        {links.map((link) => (
          <a
            aria-disabled={!url}
            href={url ? link.href : "#"}
            key={link.label}
            rel="noopener noreferrer"
            target={link.label === "Email" ? undefined : "_blank"}
          >
            {link.label}
          </a>
        ))}
        <button type="button" onClick={copyLink}>
          Copy link
        </button>
      </div>
    </div>
  );
}
