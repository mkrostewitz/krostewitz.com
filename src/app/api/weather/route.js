import {NextResponse} from "next/server";

import {
  getWeatherData,
  WEATHER_ERROR_CACHE_HEADERS,
  WEATHER_SUCCESS_CACHE_HEADERS,
} from "../../lib/weatherData.mjs";

export const runtime = "nodejs";

export async function GET() {
  try {
    const weather = await getWeatherData();

    return NextResponse.json(
      {weather},
      {
        headers: WEATHER_SUCCESS_CACHE_HEADERS,
      },
    );
  } catch (error) {
    console.error("Weather API error", error);

    return NextResponse.json(
      {error: "Weather data is unavailable right now."},
      {
        headers: WEATHER_ERROR_CACHE_HEADERS,
        status: 502,
      },
    );
  }
}
