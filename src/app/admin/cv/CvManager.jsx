"use client";

import {useEffect, useState} from "react";

import {useSnackbar} from "../../components/snackbar/SnackbarProvider";
import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

const LANGUAGES = [
  {code: "en", label: "English"},
  {code: "de", label: "German"},
];

function formatDate(value) {
  if (!value) return "Not uploaded";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes <= 0) return "Size unknown";

  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function CvManager({user}) {
  const {closeSnackbar, showSnackbar} = useSnackbar();
  const [downloads, setDownloads] = useState({});
  const [uploadingLanguage, setUploadingLanguage] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadDownloads() {
      try {
        const response = await fetch("/api/admin/cv", {cache: "no-store"});
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Unable to load CV files.");
        }

        if (!cancelled) {
          setDownloads(data.downloads || {});
          closeSnackbar();
        }
      } catch (error) {
        if (!cancelled) {
          showSnackbar({type: "error", message: error.message});
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadDownloads();

    return () => {
      cancelled = true;
    };
  }, [closeSnackbar, showSnackbar]);

  async function uploadCv(event, language) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    setUploadingLanguage(language);
    closeSnackbar();

    try {
      const body = new FormData();
      body.append("language", language);
      body.append("file", file);

      const response = await fetch("/api/admin/cv", {
        method: "POST",
        body,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to upload CV file.");
      }

      setDownloads(data.downloads || {});
      showSnackbar({type: "success", message: "CV file uploaded."});
    } catch (error) {
      showSnackbar({type: "error", message: error.message});
    } finally {
      input.value = "";
      setUploadingLanguage("");
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="cv" user={user} />

      <main className={styles.main} aria-busy={isLoading}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>CV Files</h1>
            <p className={styles.muted}>
              Upload the public CV PDFs served from DigitalOcean Spaces.
            </p>
          </div>
        </div>

        <div className={styles.cvGrid}>
          {LANGUAGES.map((language) => {
            const asset = downloads[language.code];
            const isUploading = uploadingLanguage === language.code;

            return (
              <section className={styles.portfolioPanel} key={language.code}>
                <div className={styles.panelHeader}>
                  <div className={styles.titleBlock}>
                    <h2>{language.label}</h2>
                    <p className={styles.muted}>
                      {asset?.source === "digitalocean"
                        ? "DigitalOcean Spaces"
                        : "No remote CV file configured"}
                    </p>
                  </div>
                  <span className={styles.statusBadge}>
                    {asset?.source === "digitalocean" ? "Live" : "Missing"}
                  </span>
                </div>

                <div className={styles.cvFile}>
                  <strong title={asset?.fileName || "CV PDF"}>
                    {asset?.fileName || "CV PDF"}
                  </strong>
                  <span>{formatBytes(asset?.size)}</span>
                  <span>Updated: {formatDate(asset?.updatedAt)}</span>
                  {asset?.updatedBy && <span>By: {asset.updatedBy}</span>}
                </div>

                <div className={styles.buttonRow}>
                  {asset?.url && (
                    <a
                      className={styles.ghostButton}
                      href={asset.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      Download current
                    </a>
                  )}
                  <label className={styles.uploadButton}>
                    {isUploading ? "Uploading..." : "Upload PDF"}
                    <input
                      accept="application/pdf,.pdf"
                      disabled={Boolean(uploadingLanguage)}
                      type="file"
                      onChange={(event) => uploadCv(event, language.code)}
                    />
                  </label>
                </div>
              </section>
            );
          })}
        </div>
      </main>
    </div>
  );
}
