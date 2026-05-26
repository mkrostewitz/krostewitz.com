import {NextResponse} from "next/server";

import {getPortfolioProjects} from "../../../lib/githubPortfolio";

export async function GET() {
  try {
    const portfolio = await getPortfolioProjects();
    return NextResponse.json(portfolio);
  } catch (error) {
    console.error("GitHub portfolio error", error);
    return NextResponse.json(
      {error: "Unable to load GitHub portfolio projects."},
      {status: 502}
    );
  }
}
