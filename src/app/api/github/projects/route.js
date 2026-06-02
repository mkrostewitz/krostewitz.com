import {NextResponse} from "next/server";

import {getPortfolioProjects} from "../../../lib/githubPortfolio";
import {
  PUBLIC_CACHE_HEADERS,
} from "../../../lib/publicCache";

export const revalidate = 300;

export async function GET() {
  try {
    const portfolio = await getPortfolioProjects();
    return NextResponse.json(portfolio, {headers: PUBLIC_CACHE_HEADERS});
  } catch (error) {
    console.error("GitHub portfolio error", error);
    return NextResponse.json(
      {error: "Unable to load GitHub portfolio projects."},
      {headers: PUBLIC_CACHE_HEADERS, status: 502}
    );
  }
}
