import HomeContent from "./HomeContent";
import {getFoldContent} from "./lib/fold";
import {getSiteProfile} from "./lib/siteProfile";
import {foldSeed, foldDestinations} from "./lib/foldSeed.mjs";
import {getExecutiveSummary} from "./lib/executiveSummary";

// Read the same live records for HTML and the client API, including after imports.
export const dynamic = "force-dynamic";

export default async function Home({searchParams}) {
  let initialFold = {...foldSeed, destinations: foldDestinations};
  try {
    initialFold = await getFoldContent();
    const profile = await getSiteProfile();
    initialFold.bookingUrl = profile.koalendar?.enabled ? profile.koalendar.bookingUrl : '';
  } catch (error) {
    console.error("Unable to load initial Fold content", error);
  }
  const params = await searchParams;
  initialFold.language = (params?.lng || params?.language) === 'de' ? 'de' : 'en';
  let initialSummary = null;
  try {
    initialSummary = {...await getExecutiveSummary("en"), language: "en"};
  } catch (error) {
    console.error("Unable to load initial executive summary", error);
  }
  return <HomeContent initialSummary={initialSummary} initialFold={initialFold} />;
}
