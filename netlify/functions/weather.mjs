import {
  getWeatherData,
  WEATHER_ERROR_CACHE_HEADERS,
  WEATHER_SUCCESS_CACHE_HEADERS,
} from "../../src/app/lib/weatherData.mjs";

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers || {}),
    },
  });
}

export default async function handler(request) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return jsonResponse(
      {error: "Method not allowed."},
      {
        headers: WEATHER_ERROR_CACHE_HEADERS,
        status: 405,
      },
    );
  }

  try {
    const weather = await getWeatherData();

    return jsonResponse(
      {weather},
      {
        headers: WEATHER_SUCCESS_CACHE_HEADERS,
        status: 200,
      },
    );
  } catch (error) {
    console.error("Weather function error", error);

    return jsonResponse(
      {error: "Weather data is unavailable right now."},
      {
        headers: WEATHER_ERROR_CACHE_HEADERS,
        status: 502,
      },
    );
  }
}
