import "server-only";

import {unstable_cache} from "next/cache";

import {getDb} from "./mongo";
import {
  PUBLIC_CACHE_REVALIDATE_SECONDS,
  PUBLIC_CACHE_TAGS,
  revalidatePublicTags,
} from "./publicCache";

const CONTENT_COLLECTION = "site_content";
const PORTFOLIO_ID = "github_portfolio";
const GITHUB_API = "https://api.github.com";
const DEFAULT_USERNAME = "mkrostewitz";
const REVALIDATE_SECONDS = 60 * 60;
const MAX_SELECTED_REPOS = 12;

class GitHubPortfolioError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "GitHubPortfolioError";
    this.status = status;
  }
}

export {GitHubPortfolioError};

function cleanText(value, maxLength = 120) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function getDefaultUsername() {
  return cleanText(
    process.env.GITHUB_USERNAME || process.env.GITHUB_OWNER || DEFAULT_USERNAME,
    80
  );
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return headers;
}

function normalizeHomepage(homepage) {
  if (!homepage) return null;
  const trimmed = homepage.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function normalizeRepoRef(value, fallbackOwner = getDefaultUsername()) {
  if (!value) return null;

  let ref = String(value).trim().replace(/\/$/, "");
  if (!ref) return null;

  if (/^https:\/\/github\.com\//i.test(ref)) {
    const url = new URL(ref);
    const [owner, name] = url.pathname.split("/").filter(Boolean);
    return owner && name ? `${owner}/${name}` : null;
  }

  const parts = ref.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]}/${parts[1]}`;
  }

  return fallbackOwner ? `${fallbackOwner}/${parts[0]}` : null;
}

function uniqueRepoRefs(values, fallbackOwner) {
  const refs = [];
  const seen = new Set();

  for (const value of values || []) {
    const ref = normalizeRepoRef(value, fallbackOwner);
    const key = ref?.toLowerCase();

    if (!ref || !key || seen.has(key)) continue;

    seen.add(key);
    refs.push(ref);
  }

  return refs.slice(0, MAX_SELECTED_REPOS);
}

function parseEnvSelectedRepos(username) {
  return uniqueRepoRefs(
    String(process.env.GITHUB_PORTFOLIO_REPOS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    username
  );
}

function serializeSettings(document) {
  const username = cleanText(document?.username || getDefaultUsername(), 80);

  return {
    username,
    selectedRepos: uniqueRepoRefs(document?.selectedRepos || [], username),
    showStats: document?.showStats !== false,
    updatedAt: document?.updatedAt?.toISOString?.() || null,
    updatedBy: document?.updatedBy || null,
  };
}

export async function getPortfolioSettings() {
  const db = await getDb();
  const document = await db
    .collection(CONTENT_COLLECTION)
    .findOne({_id: PORTFOLIO_ID});

  if (document) {
    return serializeSettings(document);
  }

  const username = getDefaultUsername();
  return {
    username,
    selectedRepos: parseEnvSelectedRepos(username),
    showStats: true,
    updatedAt: null,
    updatedBy: null,
  };
}

export async function savePortfolioSettings(input = {}, user) {
  const username = cleanText(input.username || getDefaultUsername(), 80);
  if (!username) {
    throw new GitHubPortfolioError("GitHub username is required.");
  }

  const selectedRepos = uniqueRepoRefs(input.selectedRepos || [], username);
  const now = new Date();
  const document = {
    username,
    selectedRepos,
    showStats: input.showStats !== false,
    updatedAt: now,
    updatedBy: user?.email || null,
  };

  const db = await getDb();
  await db.collection(CONTENT_COLLECTION).updateOne(
    {_id: PORTFOLIO_ID},
    {
      $set: document,
      $setOnInsert: {createdAt: now},
    },
    {upsert: true}
  );

  revalidatePublicTags(PUBLIC_CACHE_TAGS.portfolio);

  return serializeSettings(document);
}

async function fetchGitHub(path, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(),
    next: options.revalidate === false ? undefined : {revalidate: REVALIDATE_SECONDS},
    cache: options.cache,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new GitHubPortfolioError(
      `GitHub request failed (${response.status}) ${message}`.trim(),
      response.status
    );
  }

  return response.json();
}

export function mapGitHubRepo(repo) {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    description: repo.description,
    url: repo.html_url,
    homepage: normalizeHomepage(repo.homepage),
    language: repo.language,
    stars: repo.stargazers_count || 0,
    forks: repo.forks_count || 0,
    private: repo.private === true,
    archived: repo.archived === true,
    topics: Array.isArray(repo.topics) ? repo.topics.slice(0, 5) : [],
    updatedAt: repo.updated_at,
  };
}

export async function getAvailableGitHubRepos(username) {
  const owner = cleanText(username || getDefaultUsername(), 80);
  if (!owner) return [];

  let repos;

  if (process.env.GITHUB_TOKEN) {
    repos = await fetchGitHub(
      "/user/repos?visibility=all&affiliation=owner&sort=updated&direction=desc&per_page=100",
      {cache: "no-store", revalidate: false}
    );
    repos = repos.filter(
      (repo) => repo.owner?.login?.toLowerCase() === owner.toLowerCase()
    );
  } else {
    repos = await fetchGitHub(
      `/users/${encodeURIComponent(
        owner
      )}/repos?sort=updated&direction=desc&per_page=100`,
      {cache: "no-store", revalidate: false}
    );
  }

  return repos
    .filter((repo) => !repo.archived)
    .map(mapGitHubRepo)
    .sort(
      (left, right) =>
        new Date(right.updatedAt || 0) - new Date(left.updatedAt || 0)
    );
}

async function readPortfolioProjects() {
  const settings = await getPortfolioSettings();
  const selectedRepos = uniqueRepoRefs(settings.selectedRepos, settings.username);

  if (!selectedRepos.length) {
    return {
      projects: [],
      source: "selected",
      username: settings.username,
      showStats: settings.showStats,
      profileUrl: `https://github.com/${settings.username}`,
    };
  }

  const results = await Promise.allSettled(
    selectedRepos.map((repoRef) => {
      const [owner, name] = repoRef.split("/");
      return fetchGitHub(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`
      );
    })
  );

  const projects = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => mapGitHubRepo(result.value));

  return {
    projects,
    source: "selected",
    username: settings.username,
    showStats: settings.showStats,
    profileUrl: `https://github.com/${settings.username}`,
  };
}

export const getPortfolioProjects = unstable_cache(
  readPortfolioProjects,
  ["public-github-portfolio"],
  {
    revalidate: PUBLIC_CACHE_REVALIDATE_SECONDS,
    tags: [PUBLIC_CACHE_TAGS.portfolio],
  }
);
