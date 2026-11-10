import HomeContent from "./HomeContent";
import {getExecutiveSummary} from "./lib/executiveSummary";

// Read the same live records for HTML and the client API, including after imports.
export const dynamic = "force-dynamic";

export default async function Home() {
  let initialSummary = null;
  try {
    initialSummary = {...await getExecutiveSummary("en"), language: "en"};
  } catch (error) {
    console.error("Unable to load initial executive summary", error);
  }
  return <HomeContent initialSummary={initialSummary} />;
}
