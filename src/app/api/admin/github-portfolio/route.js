import {NextResponse} from "next/server";

import {
  getCurrentAdminUser,
  isSameOriginRequest,
  unauthorizedResponse,
} from "../../../lib/adminAuth";
import {
  getAvailableGitHubRepos,
  getPortfolioSettings,
  GitHubPortfolioError,
  savePortfolioSettings,
} from "../../../lib/githubPortfolio";

export const runtime = "nodejs";

function settingsResponse(settings, repos, repoError = null) {
  return NextResponse.json({
    settings,
    repos,
    repoError,
  });
}

export async function GET(request) {
  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  const {searchParams} = new URL(request.url);
  const savedSettings = await getPortfolioSettings();
  const requestedUsername = searchParams.get("username");
  const username = requestedUsername || savedSettings.username;
  const sameOwner =
    !requestedUsername ||
    requestedUsername.toLowerCase() === savedSettings.username.toLowerCase();
  const settings = {
    ...savedSettings,
    username,
    selectedRepos: sameOwner ? savedSettings.selectedRepos : [],
  };

  try {
    const repos = await getAvailableGitHubRepos(username);
    return settingsResponse(settings, repos);
  } catch (error) {
    console.error("Admin GitHub repo list error", error);
    return settingsResponse(
      settings,
      [],
      "Unable to load repositories from GitHub."
    );
  }
}

export async function PUT(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  }

  const user = await getCurrentAdminUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json().catch(() => ({}));
    const settings = await savePortfolioSettings(body, user);
    return NextResponse.json({settings});
  } catch (error) {
    if (error instanceof GitHubPortfolioError) {
      return NextResponse.json({error: error.message}, {status: error.status});
    }

    console.error("Admin GitHub portfolio save error", error);
    return NextResponse.json(
      {error: "Unable to save GitHub portfolio settings."},
      {status: 500}
    );
  }
}
