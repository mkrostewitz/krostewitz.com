import {NextResponse} from "next/server";

export const runtime = "nodejs";

const SOURCE_URL =
  "https://www.gkd.bayern.de/de/seen/wassertemperatur/inn/stock-18400503/messwerte/tabelle";
const SOURCE_NAME = "GKD Bayern";
const STATION_NAME = "Stock / Chiemsee";
const READING_LIMIT = 8;

function parseWaterTemperatureReadings(html) {
  const readings = [];
  const rowPattern =
    /<tr\b[^>]*>\s*<td\b[^>]*>\s*(\d{2}\.\d{2}\.\d{4}\s+\d{2}:\d{2})\s*<\/td>\s*<td\b[^>]*>\s*([+-]?\d+(?:[,.]\d+)?)\s*<\/td>\s*<\/tr>/gi;

  for (const match of String(html || "").matchAll(rowPattern)) {
    const value = Number(match[2].replace(",", "."));
    if (!Number.isFinite(value)) continue;

    readings.push({
      time: match[1],
      unit: "°C",
      value,
    });

    if (readings.length >= READING_LIMIT) break;
  }

  return readings;
}

function parseLatestWaterTemperature(html) {
  const readings = parseWaterTemperatureReadings(html);
  const latest = readings[0];

  if (!latest) return null;

  return {
    ...latest,
    readings,
    sourceName: SOURCE_NAME,
    sourceUrl: SOURCE_URL,
    station: STATION_NAME,
  };
}

export async function GET() {
  try {
    const response = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "krostewitz.com water temperature display",
      },
      next: {revalidate: 15 * 60},
    });

    if (!response.ok) {
      throw new Error(`GKD Bayern responded with ${response.status}`);
    }

    const waterTemperature = parseLatestWaterTemperature(await response.text());

    if (!waterTemperature) {
      throw new Error("Unable to parse GKD Bayern water temperature.");
    }

    return NextResponse.json(
      {waterTemperature},
      {
        headers: {
          "Cache-Control": "s-maxage=900, stale-while-revalidate=1800",
        },
      }
    );
  } catch (error) {
    console.error("Water temperature API error", error);
    return NextResponse.json(
      {error: "Water temperature is unavailable right now."},
      {status: 502}
    );
  }
}
