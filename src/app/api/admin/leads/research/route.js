import {NextResponse} from "next/server";
import {getCurrentAdminUser, isSameOriginRequest, unauthorizedResponse} from "../../../../lib/adminAuth";
import {getAiSettings} from "../../../../lib/aiSettings";
import {normalizeContact, OutreachValidationError} from "../../../../lib/leadOutreach.mjs";
import {researchContact, researchIdentity} from "../../../../lib/contactResearch.mjs";
import {getDb} from "../../../../lib/mongo";
import {getContactCategoryCatalog} from "../../../../lib/contactCategories.mjs";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET() {
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const db = await getDb();
    const categories = await getContactCategoryCatalog(db);
    return NextResponse.json({categories});
  } catch {
    return NextResponse.json({error: "Unable to load saved categories."}, {status: 500});
  }
}

export async function POST(request) {
  if (!isSameOriginRequest(request)) return NextResponse.json({error: "Invalid request origin."}, {status: 403});
  if (!await getCurrentAdminUser()) return unauthorizedResponse();
  try {
    const body = await request.json().catch(() => null);
    const contact = normalizeContact(researchIdentity(body?.contact));
    if (!contact.company && !contact.linkedinUrl && !contact.website && !contact.detailsSource) {
      throw new OutreachValidationError("Add a company or profile/source link to help identify the right person.");
    }
    if (!process.env.OPENAI_API_KEY) return NextResponse.json({error: "Configure the OpenAI API key before researching contacts."}, {status: 503});
    const {model} = await getAiSettings();
    const categories = await getContactCategoryCatalog(await getDb());
    const research = await researchContact({contact, model, categories, apiKey: process.env.OPENAI_API_KEY});
    return NextResponse.json({research});
  } catch (error) {
    if (error instanceof OutreachValidationError) return NextResponse.json({error: error.message}, {status: 400});
    return NextResponse.json({error: error.name === "TimeoutError" ? "Research took too long. Please try again." : "Unable to complete research. Check the AI configuration and web search support, or try again."}, {status: 502});
  }
}
