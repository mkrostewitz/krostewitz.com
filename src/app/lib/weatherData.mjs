const WEATHER_CACHE_SECONDS = 60;
const WEATHER_STALE_SECONDS = 5 * 60;
const WEATHER_FETCH_TIMEOUT_MS = 20000;
const CLOUD_FORECAST_HOURS = 24;
const FORECAST_REQUEST_HOURS = CLOUD_FORECAST_HOURS + 2;
const WIND_STATION_ID = "cyc-prien";
const OPEN_METEO_FREE_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_CUSTOMER_URL = "https://customer-api.open-meteo.com/v1/forecast";
const OPEN_METEO_SOURCE_URL = "https://open-meteo.com/en/docs";

const WIND_LOCATIONS = [
  {id: WIND_STATION_ID, name: "CYC Prien", lat: 47.84812, lon: 12.36938},
  {id: "west-shore", name: "Westufer", lat: 47.875, lon: 12.315},
  {id: "prien-bay", name: "Priener Bucht", lat: 47.86, lon: 12.365},
  {id: "herreninsel-north", name: "Herreninsel Nord", lat: 47.88, lon: 12.405},
  {id: "gstadt", name: "Gstadt", lat: 47.885, lon: 12.42},
  {id: "north-east", name: "Nordostsee", lat: 47.9, lon: 12.49},
  {id: "south-west", name: "Suedwestsee", lat: 47.815, lon: 12.335},
  {id: "lake-center", name: "Seemitte", lat: 47.845, lon: 12.42},
  {id: "fraueninsel", name: "Fraueninsel", lat: 47.872, lon: 12.427},
  {id: "south-east", name: "Suedostsee", lat: 47.805, lon: 12.51},
  {id: "east-shore", name: "Ostufer", lat: 47.855, lon: 12.535},
  {id: "north", name: "Nordsee", lat: 47.925, lon: 12.39},
  {id: "south", name: "Suedsee", lat: 47.79, lon: 12.405},
  {id: "north-west-lake", name: "Nordwestsee", lat: 47.895, lon: 12.35},
  {id: "north-center", name: "Noerdliche Seemitte", lat: 47.895, lon: 12.43},
  {id: "north-east-shore", name: "Nordostufer", lat: 47.885, lon: 12.515},
  {id: "west-center", name: "Westliche Seemitte", lat: 47.855, lon: 12.34},
  {id: "east-center", name: "Oestliche Seemitte", lat: 47.84, lon: 12.49},
  {id: "south-center", name: "Suedliche Seemitte", lat: 47.825, lon: 12.43},
  {id: "south-bay-west", name: "Suedwestbucht", lat: 47.81, lon: 12.36},
  {id: "south-east-bay", name: "Suedostbucht", lat: 47.82, lon: 12.54},
];

let cachedWeather = null;
let cachedWeatherExpiresAt = 0;
let pendingWeatherRequest = null;

export const WEATHER_SUCCESS_CACHE_HEADERS = {
  "Cache-Control": `public, max-age=${WEATHER_CACHE_SECONDS}, s-maxage=${WEATHER_CACHE_SECONDS}, stale-while-revalidate=${WEATHER_STALE_SECONDS}`,
};

export const WEATHER_ERROR_CACHE_HEADERS = {
  "Cache-Control": "no-store",
};

function readNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function readHourlyForecast(entry, currentTime) {
  const hourly = entry.hourly;
  const times = Array.isArray(hourly?.time) ? hourly.time : [];

  return times
    .map((time, index) => ({
      cloudCover: readNumber(hourly?.cloud_cover?.[index]),
      direction: readNumber(hourly?.wind_direction_10m?.[index]),
      gusts: readNumber(hourly?.wind_gusts_10m?.[index]),
      pressure: readNumber(hourly?.pressure_msl?.[index]),
      speed: readNumber(hourly?.wind_speed_10m?.[index]),
      temperature: readNumber(hourly?.temperature_2m?.[index]),
      time,
      weatherCode: readNumber(hourly?.weather_code?.[index]),
    }))
    .filter((forecast) => !currentTime || forecast.time > currentTime)
    .slice(0, CLOUD_FORECAST_HOURS);
}

function getOpenMeteoUrl() {
  const apiKey = String(process.env.OPEN_METEO_API_KEY || "").trim();
  const params = new URLSearchParams({
    current:
      "weather_code,temperature_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    forecast_hours: String(FORECAST_REQUEST_HOURS),
    hourly:
      "weather_code,temperature_2m,pressure_msl,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    wind_speed_unit: "kn",
    timezone: "Europe/Berlin",
  });

  params.set(
    "latitude",
    WIND_LOCATIONS.map((location) => location.lat.toFixed(4)).join(","),
  );
  params.set(
    "longitude",
    WIND_LOCATIONS.map((location) => location.lon.toFixed(4)).join(","),
  );

  if (apiKey) {
    params.set("apikey", apiKey);
  }

  const baseUrl = apiKey ? OPEN_METEO_CUSTOMER_URL : OPEN_METEO_FREE_URL;

  return `${baseUrl}?${params.toString()}`;
}

function normalizeOpenMeteoPayload(payload) {
  const rows = Array.isArray(payload) ? payload : [payload];
  const reports = rows.map((entry, index) => {
    const location = WIND_LOCATIONS[index] || {
      id: `location-${index}`,
      lat: entry.latitude,
      lon: entry.longitude,
    };
    const currentTime = entry.current?.time ?? null;

    return {
      ...location,
      cloudCover: readNumber(entry.current?.cloud_cover),
      direction: readNumber(entry.current?.wind_direction_10m),
      forecast: readHourlyForecast(entry, currentTime),
      gusts: readNumber(entry.current?.wind_gusts_10m),
      pressure: readNumber(entry.current?.pressure_msl),
      speed: readNumber(entry.current?.wind_speed_10m),
      temperature: readNumber(entry.current?.temperature_2m),
      time: currentTime,
      timezoneAbbreviation: entry.timezone_abbreviation ?? null,
      weatherCode: readNumber(entry.current?.weather_code),
    };
  });
  const stationReport =
    reports.find((report) => report.id === WIND_STATION_ID) ?? reports[0] ?? null;

  return {
    fetchedAt: new Date().toISOString(),
    points: reports.filter((report) => report.id !== stationReport?.id),
    sourceName: "Open-Meteo",
    sourceUrl: OPEN_METEO_SOURCE_URL,
    station: stationReport,
  };
}

async function fetchOpenMeteoWeather() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEATHER_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(getOpenMeteoUrl(), {
      headers: {
        "User-Agent": "krostewitz.com weather display",
      },
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      const reason =
        payload?.reason ||
        payload?.error ||
        `Open-Meteo responded with ${response.status}`;

      throw new Error(String(reason));
    }

    return normalizeOpenMeteoPayload(payload);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getWeatherData() {
  const now = Date.now();

  if (cachedWeather && cachedWeatherExpiresAt > now) {
    return cachedWeather;
  }

  if (pendingWeatherRequest) {
    return pendingWeatherRequest;
  }

  pendingWeatherRequest = fetchOpenMeteoWeather()
    .then((weather) => {
      cachedWeather = weather;
      cachedWeatherExpiresAt = Date.now() + WEATHER_CACHE_SECONDS * 1000;

      return weather;
    })
    .finally(() => {
      pendingWeatherRequest = null;
    });

  return pendingWeatherRequest;
}
