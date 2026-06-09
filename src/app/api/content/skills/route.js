import {NextResponse} from "next/server";

import {getDefaultSkills, getSkills} from "../../../lib/skills";
import {PUBLIC_CACHE_HEADERS} from "../../../lib/publicCache";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  try {
    const skills = await getSkills();
    return NextResponse.json({skills}, {headers: PUBLIC_CACHE_HEADERS});
  } catch (error) {
    console.warn("Unable to load skills", error);
    return NextResponse.json(
      {skills: getDefaultSkills()},
      {headers: PUBLIC_CACHE_HEADERS}
    );
  }
}
