"use client";

import {useEffect, useMemo, useState} from "react";

import AdminHeader from "../AdminHeader";
import styles from "../admin.module.css";

function formatDate(value) {
  if (!value) return "Not updated";

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function sortRepos(repos, selected) {
  return [...repos].sort((left, right) => {
    const leftSelected = selected.has(left.fullName);
    const rightSelected = selected.has(right.fullName);

    if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;

    return new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0);
  });
}

export default function GithubPortfolioSettings({user}) {
  const [username, setUsername] = useState("");
  const [savedSettings, setSavedSettings] = useState(null);
  const [repos, setRepos] = useState([]);
  const [selectedRepos, setSelectedRepos] = useState(new Set());
  const [status, setStatus] = useState({
    type: "message",
    text: "Loading GitHub portfolio...",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const sortedRepos = useMemo(
    () => sortRepos(repos, selectedRepos),
    [repos, selectedRepos]
  );

  async function loadGithubPortfolio(owner = username) {
    setIsLoading(true);
    setStatus(null);

    try {
      const params = owner ? `?username=${encodeURIComponent(owner)}` : "";
      const response = await fetch(`/api/admin/github-portfolio${params}`, {
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to load GitHub portfolio.");
      }

      const settings = data.settings || {};
      setSavedSettings(settings);
      setUsername(settings.username || owner || "");
      setRepos(data.repos || []);
      setSelectedRepos(new Set(settings.selectedRepos || []));

      if (data.repoError) {
        setStatus({type: "error", text: data.repoError});
      } else {
        setStatus(null);
      }
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGithubPortfolio("");
    // The initial load should run once; subsequent loads are user-triggered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleRepo(fullName) {
    setSelectedRepos((current) => {
      const next = new Set(current);

      if (next.has(fullName)) {
        next.delete(fullName);
      } else {
        next.add(fullName);
      }

      return next;
    });
  }

  async function saveGithubPortfolio(event) {
    event.preventDefault();
    setIsSaving(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/github-portfolio", {
        method: "PUT",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          username,
          selectedRepos: Array.from(selectedRepos),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || "Unable to save GitHub portfolio.");
      }

      setSavedSettings(data.settings);
      setSelectedRepos(new Set(data.settings?.selectedRepos || []));
      setStatus({type: "success", text: "GitHub portfolio selection saved."});
    } catch (error) {
      setStatus({type: "error", text: error.message});
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={styles.shell}>
      <AdminHeader active="githubPortfolio" user={user} />

      <main className={styles.main}>
        <div className={styles.toolbar}>
          <div className={styles.titleBlock}>
            <h1>GitHub Portfolio</h1>
            <p className={styles.muted}>
              Select the GitHub repositories that appear in the public portfolio.
            </p>
          </div>
        </div>

        <form className={styles.portfolioGrid} onSubmit={saveGithubPortfolio}>
          <section className={styles.portfolioPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>GitHub connection</h2>
                <p className={styles.muted}>
                  The portfolio section only shows repositories checked below.
                </p>
              </div>
              <span className={styles.statusBadge}>
                {selectedRepos.size} selected
              </span>
            </div>

            <div className={styles.repoToolbar}>
              <label className={styles.field}>
                GitHub user or organization
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="mkrostewitz"
                />
              </label>

              <button
                className={styles.ghostButton}
                disabled={isLoading}
                type="button"
                onClick={() => loadGithubPortfolio(username)}
              >
                {isLoading ? "Loading..." : "Load repositories"}
              </button>
            </div>

            <div className={styles.editorActions}>
              <p className={styles.muted}>
                Last saved: {formatDate(savedSettings?.updatedAt)}
              </p>
              <button className={styles.button} disabled={isSaving} type="submit">
                {isSaving ? "Saving..." : "Save selection"}
              </button>
            </div>

            {status && <p className={styles[status.type]}>{status.text}</p>}
          </section>

          <section className={styles.portfolioPanel}>
            <div className={styles.panelHeader}>
              <div className={styles.titleBlock}>
                <h2>Repositories</h2>
                <p className={styles.muted}>
                  Selected repositories are sorted to the top.
                </p>
              </div>
            </div>

            <div className={styles.repoList}>
              {sortedRepos.map((repo) => (
                <label className={styles.repoItem} key={repo.fullName}>
                  <input
                    checked={selectedRepos.has(repo.fullName)}
                    type="checkbox"
                    onChange={() => toggleRepo(repo.fullName)}
                  />
                  <span className={styles.repoDetails}>
                    <strong>{repo.fullName}</strong>
                    <span>
                      {[
                        repo.private ? "Private" : "Public",
                        repo.language,
                        repo.description,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </label>
              ))}

              {!isLoading && sortedRepos.length === 0 && (
                <p className={styles.muted}>No repositories found for this account.</p>
              )}
            </div>
          </section>
        </form>
      </main>
    </div>
  );
}
