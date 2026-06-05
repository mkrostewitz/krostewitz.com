"use client";

import Image from "next/image";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {ChevronDown} from "lucide-react";
import mapboxgl from "mapbox-gl";

import pageStyles from "../../page.module.css";
import {useCookieConsent} from "../consent/CookieConsent";
import styles from "./personal-section.module.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const MAX_GAUGE_SPEED = 20;
const SPEED_GAUGE_START = -150;
const SPEED_GAUGE_SWEEP = 300;
const SPEED_TICKS = Array.from({length: MAX_GAUGE_SPEED + 1}, (_, value) => {
  const angle = SPEED_GAUGE_START + (value / MAX_GAUGE_SPEED) * SPEED_GAUGE_SWEEP;

  return {
    angle,
    major: value % 5 === 0,
    value,
  };
});
const SPEED_MARKS = SPEED_TICKS.filter((tick) => tick.major);
const COMPASS_TICKS = Array.from({length: 24}, (_, index) => {
  const angle = index * 15;

  return {
    angle,
    major: angle % 90 === 0,
  };
});
const WIND_REFRESH_MS = 5 * 60 * 1000;
const WATER_TEMPERATURE_REFRESH_MS = 15 * 60 * 1000;
const WEBCAM_REFRESH_MS = 3 * 60 * 1000;
const KNOT_TO_METERS_PER_SECOND = 0.514444;
const WIND_FLOW_TIME_SCALE = 10 * 60;
const HOVER_FORECAST_HOURS = 4;
const CLOUD_FORECAST_HOURS = 24;
const CLOUD_PATTERN_POINTS = 12;
const FORECAST_REQUEST_HOURS = CLOUD_FORECAST_HOURS + 2;
const SAILING_SKELETON_METRICS = Array.from({length: 3}, (_, index) => index);
const SAILING_SKELETON_INSTRUMENTS = Array.from(
  {length: 2},
  (_, index) => index,
);
const WIND_STATION_ID = "cyc-prien";
const WEBCAM_IMAGE_URL = "https://www.cyc-prien.de/_data/webcam.jpg";
const CYC_WEBCAM_URL = "https://www.cyc-prien.de/wetter/webcam/";
const WETTER_WEBCAM_URL =
  "https://www.wetter.com/hd-live-webcams/deutschland/prien-am-chiemsee-chiemsee-schifffahrt/5785fdbf41e7d/";

const MAPBOX_BOUNDS = [
  [12.33, 47.78],
  [12.58, 47.93],
];
const MAPBOX_MAX_BOUNDS = [
  [12.2, 47.68],
  [12.72, 48.02],
];
const MAPBOX_PADDING = {
  bottom: 22,
  left: 26,
  right: 26,
  top: 62,
};

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

const MAP_STYLE = {
  background: "#0b0f19",
  backgroundDeep: "#07111f",
  cyan: "#7dd2ff",
  green: "#86ffb6",
  highWind: "#ff8a75",
  station: "#ffb15f",
  water: "#0e2a39",
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function readNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function metersPerDegreeLongitude(latitude) {
  return 111_320 * Math.cos((latitude * Math.PI) / 180);
}

function pixelsPerMeter(map) {
  const center = map.getCenter();
  const longitudeDelta = 0.001;
  const latitudeDelta = 0.001;
  const centerPoint = map.project([center.lng, center.lat]);
  const eastPoint = map.project([center.lng + longitudeDelta, center.lat]);
  const northPoint = map.project([center.lng, center.lat + latitudeDelta]);
  const longitudeMeters = longitudeDelta * metersPerDegreeLongitude(center.lat);
  const latitudeMeters = latitudeDelta * 111_320;
  const longitudePixelsPerMeter =
    longitudeMeters > 0 ? Math.abs(eastPoint.x - centerPoint.x) / longitudeMeters : 0;
  const latitudePixelsPerMeter =
    latitudeMeters > 0 ? Math.abs(northPoint.y - centerPoint.y) / latitudeMeters : 0;
  const average = (longitudePixelsPerMeter + latitudePixelsPerMeter) / 2;

  return Number.isFinite(average) && average > 0 ? average : 1;
}

function applyWindMapStyle(map) {
  const layers = map.getStyle().layers || [];

  layers.forEach((layer) => {
    try {
      if (layer.type === "background") {
        map.setPaintProperty(layer.id, "background-color", MAP_STYLE.background);
        return;
      }

      if (layer.type === "fill" && layer.id.includes("water")) {
        map.setPaintProperty(layer.id, "fill-color", MAP_STYLE.water);
        map.setPaintProperty(layer.id, "fill-opacity", 0.95);
        return;
      }

      if (layer.type === "fill" && /land|landuse|national-park/.test(layer.id)) {
        map.setPaintProperty(layer.id, "fill-color", MAP_STYLE.backgroundDeep);
        map.setPaintProperty(layer.id, "fill-opacity", 0.92);
        return;
      }

      if (layer.type === "line" && /road|bridge|tunnel/.test(layer.id)) {
        map.setPaintProperty(layer.id, "line-color", "rgba(125, 210, 255, 0.18)");
        map.setPaintProperty(layer.id, "line-opacity", 0.55);
        return;
      }

      if (layer.type === "line" && /water|admin|boundary/.test(layer.id)) {
        map.setPaintProperty(layer.id, "line-color", "rgba(125, 210, 255, 0.34)");
        map.setPaintProperty(layer.id, "line-opacity", 0.72);
        return;
      }

      if (layer.type === "symbol") {
        if (map.getPaintProperty(layer.id, "text-color") !== undefined) {
          map.setPaintProperty(layer.id, "text-color", "rgba(247, 248, 250, 0.74)");
        }
        if (map.getPaintProperty(layer.id, "text-halo-color") !== undefined) {
          map.setPaintProperty(layer.id, "text-halo-color", MAP_STYLE.background);
        }
        if (map.getPaintProperty(layer.id, "text-halo-width") !== undefined) {
          map.setPaintProperty(layer.id, "text-halo-width", 1.2);
        }
      }
    } catch {
      // Mapbox layer capabilities vary between style versions.
    }
  });
}

function bearingToVector(direction) {
  const normalizedDirection = ((direction ?? 0) + 360) % 360;
  const radians = (normalizedDirection * Math.PI) / 180;
  return {
    x: Math.sin(radians),
    y: -Math.cos(radians),
  };
}

function windToVector(direction) {
  return bearingToVector(((direction ?? 0) + 180) % 360);
}

function isGaugeStation(point) {
  return point.selected === true;
}

function drawCalmWind(ctx, point, color) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.8;
  ctx.shadowColor = color;
  ctx.shadowBlur = 5;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawWindBarb(ctx, point) {
  const speed = point.speed ?? 0;
  const roundedSpeed = Math.max(5, Math.round(speed / 5) * 5);
  const stationPoint = isGaugeStation(point);
  const color = stationPoint
    ? MAP_STYLE.station
    : speed >= 16 ? MAP_STYLE.highWind : speed >= 8 ? MAP_STYLE.cyan : MAP_STYLE.green;

  if (speed < 1 || point.direction == null) {
    drawCalmWind(ctx, point, color);
    return;
  }

  const vector = bearingToVector(point.direction);
  const perpendicular = {x: -vector.y, y: vector.x};
  const staffLength = 28;
  const barbSpacing = 5;
  const fullBarbLength = 10;
  const halfBarbLength = 6;
  let remainingSpeed = roundedSpeed;
  let cursor = staffLength;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = stationPoint ? 1 : 0.9;
  ctx.lineWidth = stationPoint ? 2.5 : 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = stationPoint ? 10 : 6;
  ctx.beginPath();
  ctx.arc(point.x, point.y, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(point.x, point.y);
  ctx.lineTo(point.x + vector.x * staffLength, point.y + vector.y * staffLength);
  ctx.stroke();

  while (remainingSpeed >= 50) {
    const attachX = point.x + vector.x * cursor;
    const attachY = point.y + vector.y * cursor;

    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(
      attachX - vector.x * 8 + perpendicular.x * 10,
      attachY - vector.y * 8 + perpendicular.y * 10,
    );
    ctx.lineTo(attachX - vector.x * 14, attachY - vector.y * 14);
    ctx.closePath();
    ctx.fill();

    remainingSpeed -= 50;
    cursor -= barbSpacing * 2;
  }

  while (remainingSpeed >= 10) {
    const attachX = point.x + vector.x * cursor;
    const attachY = point.y + vector.y * cursor;

    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(
      attachX - vector.x * 6 + perpendicular.x * fullBarbLength,
      attachY - vector.y * 6 + perpendicular.y * fullBarbLength,
    );
    ctx.stroke();

    remainingSpeed -= 10;
    cursor -= barbSpacing;
  }

  if (remainingSpeed >= 5) {
    const attachX = point.x + vector.x * cursor;
    const attachY = point.y + vector.y * cursor;

    ctx.beginPath();
    ctx.moveTo(attachX, attachY);
    ctx.lineTo(
      attachX - vector.x * 4 + perpendicular.x * halfBarbLength,
      attachY - vector.y * 4 + perpendicular.y * halfBarbLength,
    );
    ctx.stroke();
  }

  ctx.restore();
}

function createParticle(width, height) {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    age: Math.random() * 90,
    maxAge: 55 + Math.random() * 90,
  };
}

function interpolateWindVector(field, x, y) {
  if (!field.length) return null;

  let totalWeight = 0;
  let flowX = 0;
  let flowY = 0;
  let speed = 0;

  field.forEach((point) => {
    const distanceSquared = Math.max((point.x - x) ** 2 + (point.y - y) ** 2, 700);
    const weight = 1 / distanceSquared;
    const pointSpeed = Math.max(point.speed ?? 0, 1);
    const vector = windToVector(point.direction);

    totalWeight += weight;
    flowX += vector.x * pointSpeed * weight;
    flowY += vector.y * pointSpeed * weight;
    speed += pointSpeed * weight;
  });

  if (!totalWeight) return null;

  const magnitude = Math.hypot(flowX, flowY) || 1;

  return {
    speed: speed / totalWeight,
    vector: {
      x: flowX / magnitude,
      y: flowY / magnitude,
    },
  };
}

function formatWeatherTime(value, abbreviation, language) {
  if (!value) return null;

  const [datePart, timePart = ""] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);

  if (![year, month, day].every(Number.isFinite)) return value;

  const locale = language === "de" ? "de-DE" : "en-US";
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const formattedTime = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(date);

  return abbreviation ? `${formattedTime} ${abbreviation}` : formattedTime;
}

function formatForecastHour(value, language) {
  if (!value) return "--";

  const [datePart, timePart = ""] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour = 0, minute = 0] = timePart.split(":").map(Number);

  if (![year, month, day].every(Number.isFinite)) return value;

  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, hour, minute)));
}

function formatGkdReadingTime(value) {
  if (!value) return "--";

  const [, timePart] = value.split(" ");
  return timePart || value;
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

function compactForecastSeries(forecasts, maxPoints) {
  if (forecasts.length <= maxPoints) return forecasts;

  const step = (forecasts.length - 1) / (maxPoints - 1);
  const compacted = [];
  const seenTimes = new Set();

  for (let index = 0; index < maxPoints; index += 1) {
    const forecast = forecasts[Math.round(index * step)];
    if (!forecast || seenTimes.has(forecast.time)) continue;

    compacted.push(forecast);
    seenTimes.add(forecast.time);
  }

  return compacted;
}

function getWeatherIconType(weatherCode, cloudCover) {
  if (weatherCode != null) {
    if (
      (weatherCode >= 51 && weatherCode <= 67) ||
      (weatherCode >= 80 && weatherCode <= 82) ||
      weatherCode >= 95
    ) {
      return "rain";
    }

    if (weatherCode === 0) return "sun";
    if (weatherCode === 1 || weatherCode === 2) return "partly";
    return "cloud";
  }

  if (cloudCover == null) return "cloud";
  if (cloudCover <= 15) return "sun";
  if (cloudCover <= 65) return "partly";
  return "cloud";
}

function degreesToCompass(degrees, language) {
  if (degrees == null) return "--";

  const english = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const german = [
    "N",
    "NNO",
    "NO",
    "ONO",
    "O",
    "OSO",
    "SO",
    "SSO",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const labels = language === "de" ? german : english;
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return labels[index];
}

function buildOpenMeteoUrl() {
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

  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

function SailingStationSkeleton() {
  return (
    <>
      <div className={`${styles.windMap} ${styles.windMapLoading}`} aria-hidden>
        <div className={`${styles.weatherOverlay} ${styles.weatherOverlayTop}`}>
          {SAILING_SKELETON_METRICS.map((item) => (
            <div className={styles.weatherBox} key={`weather-skeleton-${item}`}>
              <span className={styles.weatherLabelSkeleton} />
              <span className={styles.weatherValueSkeleton} />
              {item === 1 && <span className={styles.weatherTextSkeleton} />}
            </div>
          ))}
        </div>
        <div className={styles.windMapSkeletonCanvas}>
          <span />
          <span />
          <span />
          <span />
        </div>
        <div className={`${styles.weatherOverlay} ${styles.weatherOverlayBottom}`}>
          <div className={`${styles.weatherBox} ${styles.weatherBoxWide}`}>
            <span className={styles.weatherLabelSkeleton} />
            <span className={styles.weatherValueRow}>
              <span className={styles.weatherIconSkeleton} />
              <span className={styles.weatherCloudText}>
                <span className={styles.weatherValueSkeleton} />
                <span className={styles.weatherTextSkeleton} />
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className={styles.instrumentGrid} aria-hidden>
        {SAILING_SKELETON_INSTRUMENTS.map((item) => (
          <div
            className={`${styles.instrument} ${styles.instrumentLoading}`}
            key={`instrument-skeleton-${item}`}
          >
            <div className={styles.instrumentReadout}>
              <span className={styles.weatherLabelSkeleton} />
              <small className={styles.weatherTextSkeleton} />
            </div>
            <div className={styles.instrumentDialSkeleton} />
            <p className={styles.instrumentMeta}>
              <span className={styles.weatherTextSkeleton} />
            </p>
          </div>
        ))}
      </div>
    </>
  );
}

const PersonalSection = () => {
  const {t, i18n} = useTranslation(undefined, {keyPrefix: "personal"});
  const {t: tConsent} = useTranslation(undefined, {
    keyPrefix: "cookieConsent",
  });
  const {
    allowExternalServices,
    isReady: isConsentReady,
    openConsentSettings,
  } = useCookieConsent();
  const canvasRef = useRef(null);
  const windMapDragRef = useRef({
    active: false,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pointerId: null,
    startX: 0,
    startY: 0,
  });
  const mapRef = useRef(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const [mapContainerNode, setMapContainerNode] = useState(null);
  const [selectedWindPointId, setSelectedWindPointId] = useState(WIND_STATION_ID);
  const [windMapError, setWindMapError] = useState(false);
  const [windMapReady, setWindMapReady] = useState(false);
  const [webcamTick, setWebcamTick] = useState(Date.now());
  const [webcamAvailable, setWebcamAvailable] = useState(true);
  const [webcamImageReady, setWebcamImageReady] = useState(false);
  const [windMapHover, setWindMapHover] = useState(null);
  const [cloudPatternOpen, setCloudPatternOpen] = useState(false);
  const [waterTemperatureReport, setWaterTemperatureReport] = useState({
    data: null,
    status: "loading",
  });
  const [windReport, setWindReport] = useState({
    error: null,
    points: [],
    station: null,
    status: "loading",
  });

  const hobbies = t("hobbies", {returnObjects: true, defaultValue: []});
  const hobbyList = Array.isArray(hobbies) ? hobbies : [];
  const allWindReports = useMemo(
    () => (windReport.station ? [windReport.station, ...windReport.points] : windReport.points),
    [windReport.points, windReport.station],
  );
  const station =
    allWindReports.find((report) => report.id === selectedWindPointId) ??
    allWindReports.find((report) => report.id === WIND_STATION_ID) ??
    allWindReports[0] ??
    null;
  const stationName = station?.name ?? station?.id ?? "CYC Prien";
  const cloudCover = station?.cloudCover;
  const speed = station?.speed;
  const direction = station?.direction;
  const gusts = station?.gusts;
  const pressure = station?.pressure;
  const temperature = station?.temperature;
  const weatherCode = station?.weatherCode;
  const waterTemperature = waterTemperatureReport.data?.value;
  const externalDataStatus = !isConsentReady
    ? "loading"
    : allowExternalServices
      ? windReport.status
      : "blocked";
  const isInitialWindLoading = externalDataStatus === "loading";
  const isWaterTemperatureLoading =
    !isConsentReady ||
    (allowExternalServices && waterTemperatureReport.status === "loading");
  const cloudCoverValue = cloudCover == null ? "--" : `${Math.round(cloudCover)}%`;
  const pressureValue = pressure == null ? "--" : `${Math.round(pressure)} hPa`;
  const temperatureValue = temperature == null ? "--" : `${temperature.toFixed(1)} °C`;
  const waterTemperatureValue =
    waterTemperature == null ? "--" : `${waterTemperature.toFixed(1)} °C`;
  const waterTemperatureMeta = waterTemperatureReport.data?.time
    ? t("sailing.waterTemperatureUpdated", {
        time: waterTemperatureReport.data.time,
      })
    : waterTemperatureReport.status === "loading"
      ? t("sailing.waterTemperatureLoading")
      : t("sailing.waterTemperatureUnavailable");
  const weatherIconType = getWeatherIconType(weatherCode, cloudCover);
  const weatherIconClass =
    {
      cloud: styles.weatherIconCloud,
      partly: styles.weatherIconPartly,
      rain: styles.weatherIconRain,
      sun: styles.weatherIconSun,
    }[weatherIconType] ?? styles.weatherIconCloud;
  const weatherStateLabel = t(`sailing.weatherState.${weatherIconType}`);
  const windSpeedValue = speed == null ? "--" : speed.toFixed(1);
  const windGustValue = gusts == null ? "--" : gusts.toFixed(1);
  const gaugeProgress = clamp((speed ?? 0) / MAX_GAUGE_SPEED, 0, 1);
  const gaugeAngle = SPEED_GAUGE_START + gaugeProgress * SPEED_GAUGE_SWEEP;
  const directionLabel = degreesToCompass(direction, i18n.language);
  const windDirectionValue =
    direction == null ? "--" : `${Math.round(direction)}° ${directionLabel}`;
  const stationForecast = station?.forecast ?? [];
  const forecastLabel = t("sailing.forecast");
  const noForecastLabel = t("sailing.noForecast");
  const metricForecastRows = stationForecast
    .slice(0, HOVER_FORECAST_HOURS)
    .map((forecast) => ({
      pressure:
        forecast.pressure == null ? "--" : `${Math.round(forecast.pressure)} hPa`,
      temperature:
        forecast.temperature == null ? "--" : `${forecast.temperature.toFixed(1)} °C`,
      time: formatForecastHour(forecast.time, i18n.language),
    }));
  const waterTemperatureRows = (
    waterTemperatureReport.data?.readings ?? []
  )
    .slice(0, HOVER_FORECAST_HOURS)
    .map((reading) => ({
      temperature:
        reading.value == null ? "--" : `${Number(reading.value).toFixed(1)} °C`,
      time: formatGkdReadingTime(reading.time),
    }));
  const forecastRows = stationForecast
    .slice(0, HOVER_FORECAST_HOURS)
    .map((forecast) => {
      const hour = formatForecastHour(forecast.time, i18n.language);
      const speedText =
        forecast.speed == null ? "--" : `${forecast.speed.toFixed(1)} kn`;
      const gustText =
        forecast.gusts == null ? "--" : `${forecast.gusts.toFixed(1)} kn`;
      const directionText =
        forecast.direction == null
          ? "--"
          : `${Math.round(forecast.direction)}° ${degreesToCompass(
              forecast.direction,
              i18n.language,
            )}`;

      return {
        direction: directionText,
        gusts: gustText,
        speed: speedText,
        time: hour,
      };
    });
  const windSpeedForecast = forecastRows
    .map((forecast) => `${forecast.time}: ${forecast.speed} / ${forecast.gusts}`)
    .join(" · ");
  const directionForecast = forecastRows
    .map((forecast) => `${forecast.time}: ${forecast.direction}, ${forecast.speed}`)
    .join(" · ");
  const nextCloudForecast = stationForecast.find(
    (forecast) => forecast.cloudCover != null,
  );
  const cloudTrendTime = nextCloudForecast?.time
    ? formatForecastHour(nextCloudForecast.time, i18n.language)
    : null;
  const cloudTrendDelta =
    cloudCover == null || nextCloudForecast?.cloudCover == null
      ? null
      : Math.round(nextCloudForecast.cloudCover - cloudCover);
  const cloudTrendText = (() => {
    if (cloudTrendDelta == null || !cloudTrendTime) {
      return t("sailing.cloudTrendUnknown");
    }

    if (Math.abs(cloudTrendDelta) < 5) {
      return t("sailing.cloudTrendStable", {time: cloudTrendTime});
    }

    const change = `${cloudTrendDelta > 0 ? "+" : ""}${cloudTrendDelta}%`;

    return cloudTrendDelta > 0
      ? t("sailing.cloudTrendRising", {change, time: cloudTrendTime})
      : t("sailing.cloudTrendClearing", {change, time: cloudTrendTime});
  })();
  const currentCloudForecast =
    station?.time && cloudCover != null
      ? {
          cloudCover,
          time: station.time,
          weatherCode,
        }
      : null;
  const cloudForecastSeries = [
    ...(currentCloudForecast ? [currentCloudForecast] : []),
    ...stationForecast.filter((forecast) => forecast.cloudCover != null),
  ].slice(0, CLOUD_FORECAST_HOURS);
  const cloudPatternRows = compactForecastSeries(
    cloudForecastSeries,
    CLOUD_PATTERN_POINTS,
  ).map((forecast, index) => {
    const cloudValue = Math.round(clamp(forecast.cloudCover ?? 0, 0, 100));

    return {
      cloudCover: `${cloudValue}%`,
      iconClass:
        {
          cloud: styles.cloudPatternIconCloud,
          partly: styles.cloudPatternIconPartly,
          rain: styles.cloudPatternIconRain,
          sun: styles.cloudPatternIconSun,
        }[getWeatherIconType(forecast.weatherCode, forecast.cloudCover)] ??
        styles.cloudPatternIconCloud,
      key: `${forecast.time}-${index}`,
      time:
        index === 0 && currentCloudForecast
          ? t("sailing.now")
          : formatForecastHour(forecast.time, i18n.language),
    };
  });
  const cloudPatternToggleLabel = cloudPatternOpen
    ? t("sailing.hideCloudPattern")
    : t("sailing.showCloudPattern");
  const windSpeedTooltip = forecastRows.length
    ? `${forecastLabel} ${t("sailing.windSpeed")}/${t(
        "sailing.windGusts",
      )}: ${windSpeedForecast}`
    : `${forecastLabel}: ${noForecastLabel}`;
  const compassTooltip = forecastRows.length
    ? `${forecastLabel} ${t("sailing.windDirection")}: ${directionForecast}`
    : `${forecastLabel}: ${noForecastLabel}`;
  const temperatureTooltip = metricForecastRows.length
    ? `${forecastLabel} ${t("sailing.temperature")}`
    : `${forecastLabel}: ${noForecastLabel}`;
  const pressureTooltip = metricForecastRows.length
    ? `${forecastLabel} ${t("sailing.airPressure")}`
    : `${forecastLabel}: ${noForecastLabel}`;
  const waterTemperatureTooltip = waterTemperatureRows.length
    ? `${t("sailing.waterMeasurements")} ${t("sailing.waterTemperature")}`
    : `${t("sailing.waterMeasurements")}: ${noForecastLabel}`;
  const mapWindReports = useMemo(
    () =>
      allWindReports.map((report) => ({
        ...report,
        selected: report.id === station?.id,
      })),
    [allWindReports, station?.id],
  );
  const handleMapContainerRef = useCallback((node) => {
    setMapContainerNode(node);
  }, []);
  const projectWindReport = useCallback(
    (report) => {
      const map = mapRef.current;

      if (!windMapReady || !map) return null;

      const point = map.project([report.lon, report.lat]);
      return {
        x: point.x,
        y: point.y,
      };
    },
    [windMapReady],
  );
  const findNearestWindReport = (event, maxDistance = 28) => {
    const canvas = canvasRef.current;
    if (!canvas || !windMapReady || !mapRef.current || !mapWindReports.length) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const projectedReports = mapWindReports
      .map((report) => {
        const projectedReport = projectWindReport(report);
        return projectedReport ? {...report, ...projectedReport} : null;
      })
      .filter(Boolean);

    if (!projectedReports.length) return null;

    const nearestReport = projectedReports.reduce(
      (nearest, report) => {
        const distance = (report.x - pointerX) ** 2 + (report.y - pointerY) ** 2;
        return distance < nearest.distance ? {distance, report} : nearest;
      },
      {distance: Number.POSITIVE_INFINITY, report: null},
    );

    if (!nearestReport.report || Math.sqrt(nearestReport.distance) > maxDistance) {
      return null;
    }

    return {
      rect,
      report: nearestReport.report,
    };
  };
  const handleWindMapPointerMove = (event) => {
    const drag = windMapDragRef.current;

    if (drag.active && drag.pointerId === event.pointerId) {
      const deltaX = event.clientX - drag.lastX;
      const deltaY = event.clientY - drag.lastY;
      const totalMovement = Math.hypot(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );

      if (totalMovement > 4) {
        drag.dragging = true;
      }

      if (drag.dragging && mapRef.current) {
        const map = mapRef.current;
        const centerPoint = map.project(map.getCenter());
        map.setCenter(
          map.unproject([
            centerPoint.x - deltaX,
            centerPoint.y - deltaY,
          ]),
        );
        drag.lastX = event.clientX;
        drag.lastY = event.clientY;
        setWindMapHover(null);
        event.preventDefault();
        return;
      }
    }

    const nearestReport = findNearestWindReport(event);

    if (!nearestReport) {
      setWindMapHover(null);
      return;
    }

    const {rect, report} = nearestReport;
    const tooltipX = clamp(report.x + 18, 110, rect.width - 110);
    const tooltipY = clamp(report.y - 18, 48, rect.height - 18);

    setWindMapHover({
      directionLabel: degreesToCompass(report.direction, i18n.language),
      point: report,
      x: tooltipX,
      y: tooltipY,
    });
  };
  const handleWindMapPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!windMapReady || !mapRef.current) return;

    windMapDragRef.current = {
      active: true,
      dragging: false,
      lastX: event.clientX,
      lastY: event.clientY,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const handleWindMapPointerUp = (event) => {
    const drag = windMapDragRef.current;

    if (drag.active && drag.pointerId === event.pointerId) {
      const wasDragging = drag.dragging;
      windMapDragRef.current = {
        active: false,
        dragging: false,
        lastX: 0,
        lastY: 0,
        pointerId: null,
        startX: 0,
        startY: 0,
      };
      event.currentTarget.releasePointerCapture?.(event.pointerId);

      if (wasDragging) {
        event.preventDefault();
        return;
      }
    }

    const nearestReport = findNearestWindReport(event, 34);

    if (!nearestReport?.report?.id) return;

    setSelectedWindPointId(nearestReport.report.id);
  };
  const handleWindMapPointerCancel = (event) => {
    if (windMapDragRef.current.pointerId !== event.pointerId) return;

    windMapDragRef.current = {
      active: false,
      dragging: false,
      lastX: 0,
      lastY: 0,
      pointerId: null,
      startX: 0,
      startY: 0,
    };
    setWindMapHover(null);
  };
  const handleWindMapPointerLeave = () => {
    if (windMapDragRef.current.active) return;
    setWindMapHover(null);
  };
  const updatedLabel = formatWeatherTime(
    station?.time,
    station?.timezoneAbbreviation,
    i18n.language,
  );
  const webcamSrc = useMemo(
    () => `${WEBCAM_IMAGE_URL}?t=${Math.floor(webcamTick / WEBCAM_REFRESH_MS)}`,
    [webcamTick],
  );
  const shouldShowWebcamSkeleton =
    !isConsentReady ||
    (allowExternalServices && webcamAvailable && !webcamImageReady);

  useEffect(() => {
    if (!isConsentReady) return undefined;

    if (!allowExternalServices) {
      setWindReport({
        error: null,
        points: [],
        station: null,
        status: "blocked",
      });
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    async function loadWind() {
      setWindReport((currentReport) => ({
        ...currentReport,
        error: null,
        status: currentReport.station ? "refreshing" : "loading",
      }));

      try {
        const response = await fetch(buildOpenMeteoUrl(), {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Open-Meteo responded with ${response.status}`);
        }

        const payload = await response.json();
        if (!active) return;

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
          reports.find((report) => report.id === WIND_STATION_ID) ?? reports[0];

        setWindReport({
          error: null,
          points: reports.filter((report) => report.id !== stationReport?.id),
          station: stationReport ?? null,
          status: "ready",
        });
      } catch (error) {
        if (error?.name === "AbortError" || !active) return;

        setWindReport((currentReport) => ({
          ...currentReport,
          error,
          status: "error",
        }));
      }
    }

    void loadWind();
    const interval = window.setInterval(loadWind, WIND_REFRESH_MS);

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [allowExternalServices, isConsentReady]);

  useEffect(() => {
    if (!isConsentReady) return undefined;

    if (!allowExternalServices) {
      setWaterTemperatureReport({
        data: null,
        status: "blocked",
      });
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    async function loadWaterTemperature() {
      setWaterTemperatureReport((currentReport) => ({
        ...currentReport,
        status: currentReport.data ? "refreshing" : "loading",
      }));

      try {
        const response = await fetch("/api/water-temperature", {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            payload.error || `Water temperature responded with ${response.status}`,
          );
        }

        if (!active) return;

        setWaterTemperatureReport({
          data: payload.waterTemperature ?? null,
          status: "ready",
        });
      } catch (error) {
        if (error?.name === "AbortError" || !active) return;

        setWaterTemperatureReport((currentReport) => ({
          ...currentReport,
          status: "error",
        }));
      }
    }

    void loadWaterTemperature();
    const interval = window.setInterval(
      loadWaterTemperature,
      WATER_TEMPERATURE_REFRESH_MS,
    );

    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, [allowExternalServices, isConsentReady]);

  useEffect(() => {
    if (!isConsentReady || !allowExternalServices) return undefined;

    const interval = window.setInterval(() => {
      setWebcamTick(Date.now());
    }, WEBCAM_REFRESH_MS);

    return () => window.clearInterval(interval);
  }, [allowExternalServices, isConsentReady]);

  useEffect(() => {
    if (!isConsentReady) return;

    if (allowExternalServices && webcamAvailable) {
      setWebcamImageReady(false);
    }
  }, [allowExternalServices, isConsentReady, webcamAvailable, webcamSrc]);

  useEffect(() => {
    if (
      !isConsentReady ||
      !allowExternalServices ||
      !mapboxToken ||
      !mapContainerNode ||
      mapRef.current
    ) {
      return undefined;
    }

    mapboxgl.accessToken = mapboxToken;

    let map;
    let loaded = false;

    try {
      map = new mapboxgl.Map({
        attributionControl: true,
        bounds: MAPBOX_BOUNDS,
        container: mapContainerNode,
        fitBoundsOptions: {
          duration: 0,
          padding: MAPBOX_PADDING,
        },
        interactive: false,
        maxBounds: MAPBOX_MAX_BOUNDS,
        pitch: 0,
        style: "mapbox://styles/mapbox/dark-v11",
      });
    } catch {
      setWindMapError(true);
      setWindMapReady(false);
      return undefined;
    }

    mapRef.current = map;
    setWindMapError(false);

    map.on("load", () => {
      loaded = true;
      applyWindMapStyle(map);
      map.fitBounds(MAPBOX_BOUNDS, {duration: 0, padding: MAPBOX_PADDING});
      setWindMapError(false);
      setWindMapReady(true);
    });

    map.on("error", () => {
      if (!loaded) {
        setWindMapError(true);
        setWindMapReady(false);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      setWindMapReady(false);
    };
  }, [allowExternalServices, isConsentReady, mapContainerNode, mapboxToken]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let animationFrame;
    let lastFrame = 0;
    let particles = [];
    let reducedMotion = mediaQuery.matches;

    const windPoints = mapWindReports;

    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      const pixelRatio = window.devicePixelRatio || 1;
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      if (mapRef.current) {
        mapRef.current.resize();
        mapRef.current.fitBounds(MAPBOX_BOUNDS, {
          duration: 0,
          padding: MAPBOX_PADDING,
        });
      }
      const particleCount = reducedMotion
        ? 0
        : Math.round(clamp((width * height) / 1400, 280, 620));
      particles = Array.from({length: particleCount}, () =>
        createParticle(width, height),
      );
    }

    function draw(timestamp) {
      const deltaSeconds = lastFrame ? clamp((timestamp - lastFrame) / 1000, 0.008, 0.05) : 0.016;
      lastFrame = timestamp;
      context.clearRect(0, 0, width, height);

      if (!windMapReady || !mapRef.current) {
        animationFrame = window.requestAnimationFrame(draw);
        return;
      }

      const flowPixelsPerMeter = pixelsPerMeter(mapRef.current);
      const projectedField = windPoints
        .map((point) => {
          const projectedPoint = projectWindReport(point);
          return projectedPoint ? {...point, ...projectedPoint} : null;
        })
        .filter(Boolean);

      if (!reducedMotion && projectedField.length) {
        context.save();
        context.globalCompositeOperation = "lighter";
        context.lineCap = "round";
        particles.forEach((particle, index) => {
          const wind = interpolateWindVector(projectedField, particle.x, particle.y);
          const vector = wind?.vector ?? {x: 1, y: 0};
          const windSpeed = Math.max(wind?.speed ?? 0, 1.8);
          const movement =
            windSpeed *
            KNOT_TO_METERS_PER_SECOND *
            flowPixelsPerMeter *
            WIND_FLOW_TIME_SCALE *
            deltaSeconds;
          const trailLength = Math.max(
            7,
            movement * 3 + clamp(windSpeed, 0, 24) * 0.25,
          );
          const alpha = 0.2 + clamp(windSpeed, 0, 20) * 0.018;

          particle.x += vector.x * movement;
          particle.y += vector.y * movement;
          particle.age += deltaSeconds * 60;

          context.strokeStyle =
            windSpeed >= 12
              ? `rgba(190, 232, 255, ${alpha + 0.12})`
              : `rgba(151, 198, 255, ${alpha})`;
          context.lineWidth = windSpeed >= 12 ? 1.8 : 1.35;
          context.beginPath();
          context.moveTo(
            particle.x - vector.x * trailLength,
            particle.y - vector.y * trailLength,
          );
          context.lineTo(particle.x, particle.y);
          context.stroke();

          if (
            particle.x < -12 ||
            particle.x > width + 12 ||
            particle.y < -12 ||
            particle.y > height + 12 ||
            particle.age > particle.maxAge
          ) {
            particles[index] = createParticle(width, height);
          }
        });
        context.restore();
      }

      projectedField
        .filter((point) => !isGaugeStation(point))
        .forEach((point) => drawWindBarb(context, point));
      projectedField
        .filter((point) => isGaugeStation(point))
        .forEach((point) => drawWindBarb(context, point));

      animationFrame = window.requestAnimationFrame(draw);
    }

    resizeCanvas();
    const resizeObserver = new ResizeObserver(resizeCanvas);
    resizeObserver.observe(canvas);

    const updateReducedMotion = () => {
      reducedMotion = mediaQuery.matches;
      resizeCanvas();
    };

    mediaQuery.addEventListener("change", updateReducedMotion);
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      mediaQuery.removeEventListener("change", updateReducedMotion);
    };
  }, [mapWindReports, projectWindReport, windMapReady]);

  return (
    <section id="persoenlich" className={`${pageStyles.section} ${styles.section}`}>
      <span id="personal" className={styles.anchorAlias} aria-hidden="true" />
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("eyebrow")}</p>
        <h2>{t("title")}</h2>
        <p className={pageStyles.lead}>{t("intro")}</p>
      </div>

      <div className={styles.hobbyList} aria-label={t("hobbyLabel")}>
        {hobbyList.map((hobby) => (
          <span key={hobby}>{hobby}</span>
        ))}
      </div>

      <div
        className={styles.sailingPanel}
        aria-busy={isInitialWindLoading || isWaterTemperatureLoading}
      >
        <div className={styles.sailingHeader}>
          <div>
            <p className={styles.panelEyebrow}>{t("sailing.eyebrow")}</p>
            <h3>{t("sailing.title")}</h3>
            <p>{t("sailing.subtitle", {location: stationName})}</p>
          </div>
          <div className={styles.dataStatus} data-state={externalDataStatus}>
            {externalDataStatus === "blocked" &&
              tConsent("externalServicesBlockedShort")}
            {externalDataStatus === "loading" && t("sailing.loading")}
            {externalDataStatus === "error" && t("sailing.error")}
            {externalDataStatus !== "blocked" &&
              externalDataStatus !== "loading" &&
              externalDataStatus !== "error" &&
              updatedLabel &&
              t("sailing.updated", {time: updatedLabel})}
          </div>
        </div>

        {isInitialWindLoading ? (
          <div
            className={`${styles.windLayout} ${styles.windLayoutSkeleton}`}
            role="status"
            aria-label={t("sailing.loading")}
          >
            <SailingStationSkeleton />
          </div>
        ) : (
          <div className={styles.windLayout}>
            <div className={styles.windMap}>
              <div className={`${styles.weatherOverlay} ${styles.weatherOverlayTop}`}>
                <div
                  className={`${styles.weatherBox} ${styles.weatherBoxInteractive}`}
                  role="img"
                  aria-label={temperatureTooltip}
                  tabIndex={0}
                >
                  <span>{t("sailing.temperature")}</span>
                  <strong>{temperatureValue}</strong>
                  <div
                    className={`${styles.forecastTooltip} ${styles.weatherForecastTooltip}`}
                    aria-hidden
                  >
                    <strong>{forecastLabel}</strong>
                    {metricForecastRows.length ? (
                      <div className={`${styles.forecastTable} ${styles.forecastTableCompact}`}>
                        <span>{t("sailing.forecastTime")}</span>
                        <span>{t("sailing.temperature")}</span>
                        {metricForecastRows.map((forecast) => (
                          <span
                            key={`temperature-forecast-${forecast.time}`}
                            className={styles.forecastRow}
                          >
                            <span>{forecast.time}</span>
                            <span>{forecast.temperature}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.forecastEmpty}>{noForecastLabel}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`${styles.weatherBox} ${styles.weatherBoxWater} ${styles.weatherBoxInteractive}`}
                  role="img"
                  aria-label={waterTemperatureTooltip}
                  tabIndex={0}
                >
                  <span>{t("sailing.waterTemperature")}</span>
                  {isWaterTemperatureLoading ? (
                    <span className={styles.weatherValueSkeleton} aria-hidden />
                  ) : (
                    <strong>{waterTemperatureValue}</strong>
                  )}
                  {isWaterTemperatureLoading ? (
                    <span
                      className={`${styles.weatherTextSkeleton} ${styles.weatherTextSkeletonShort}`}
                      aria-hidden
                    />
                  ) : (
                    <small>{waterTemperatureMeta}</small>
                  )}
                  <div
                    className={`${styles.forecastTooltip} ${styles.weatherForecastTooltip}`}
                    aria-hidden
                  >
                    <strong>{t("sailing.waterMeasurements")}</strong>
                    {waterTemperatureRows.length ? (
                      <div className={`${styles.forecastTable} ${styles.forecastTableCompact}`}>
                        <span>{t("sailing.forecastTime")}</span>
                        <span>{t("sailing.waterTemperature")}</span>
                        {waterTemperatureRows.map((reading) => (
                          <span
                            key={`water-temperature-reading-${reading.time}`}
                            className={styles.forecastRow}
                          >
                            <span>{reading.time}</span>
                            <span>{reading.temperature}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.forecastEmpty}>{noForecastLabel}</span>
                    )}
                  </div>
                </div>
                <div
                  className={`${styles.weatherBox} ${styles.weatherBoxInteractive}`}
                  role="img"
                  aria-label={pressureTooltip}
                  tabIndex={0}
                >
                  <span>{t("sailing.airPressure")}</span>
                  <strong>{pressureValue}</strong>
                  <div
                    className={`${styles.forecastTooltip} ${styles.weatherForecastTooltip}`}
                    aria-hidden
                  >
                    <strong>{forecastLabel}</strong>
                    {metricForecastRows.length ? (
                      <div className={`${styles.forecastTable} ${styles.forecastTableCompact}`}>
                        <span>{t("sailing.forecastTime")}</span>
                        <span>{t("sailing.airPressure")}</span>
                        {metricForecastRows.map((forecast) => (
                          <span
                            key={`pressure-forecast-${forecast.time}`}
                            className={styles.forecastRow}
                          >
                            <span>{forecast.time}</span>
                            <span>{forecast.pressure}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.forecastEmpty}>{noForecastLabel}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className={styles.windMapFrame}>
                {mapboxToken && allowExternalServices && (
                  <div
                    ref={handleMapContainerRef}
                    className={styles.windMapBackground}
                    aria-hidden
                  />
                )}
                <canvas
                  ref={canvasRef}
                  aria-label={t("sailing.windMapAlt")}
                  onPointerCancel={handleWindMapPointerCancel}
                  onPointerDown={handleWindMapPointerDown}
                  onPointerLeave={handleWindMapPointerLeave}
                  onPointerMove={handleWindMapPointerMove}
                  onPointerUp={handleWindMapPointerUp}
                />
                {!allowExternalServices && (
                  <div className={styles.consentNotice}>
                    <p>{tConsent("externalServicesBlocked")}</p>
                    <button onClick={openConsentSettings} type="button">
                      {tConsent("actions.manage")}
                    </button>
                  </div>
                )}
                {allowExternalServices && !mapboxToken && (
                  <div className={styles.consentNotice}>
                    <p>{t("sailing.missingMapboxToken")}</p>
                  </div>
                )}
                {allowExternalServices && mapboxToken && windMapError && (
                  <div className={styles.consentNotice}>
                    <p>{t("sailing.mapboxUnavailable")}</p>
                  </div>
                )}
                {windMapHover && (
                  <div
                    className={styles.windMapTooltip}
                    style={{
                      left: `${windMapHover.x}px`,
                      top: `${windMapHover.y}px`,
                    }}
                  >
                    <strong>{windMapHover.point.name ?? windMapHover.point.id}</strong>
                    <span>
                      {t("sailing.windSpeed")}:{" "}
                      {windMapHover.point.speed == null
                        ? "--"
                        : windMapHover.point.speed.toFixed(1)}{" "}
                      kn
                    </span>
                    <span>
                      {t("sailing.windGusts")}:{" "}
                      {windMapHover.point.gusts == null
                        ? "--"
                        : windMapHover.point.gusts.toFixed(1)}{" "}
                      kn
                    </span>
                    <span>
                      {t("sailing.windDirection")}:{" "}
                      {windMapHover.point.direction == null
                        ? "--"
                        : `${Math.round(windMapHover.point.direction)}° ${
                            windMapHover.directionLabel
                          }`}
                    </span>
                  </div>
                )}
              </div>
              <div className={`${styles.weatherOverlay} ${styles.weatherOverlayBottom}`}>
                <button
                  type="button"
                  className={`${styles.weatherBox} ${styles.weatherBoxWide} ${styles.cloudForecastToggle}`}
                  aria-controls="cloud-forecast-pattern"
                  aria-expanded={cloudPatternOpen}
                  aria-label={cloudPatternToggleLabel}
                  title={cloudPatternToggleLabel}
                  onClick={() => setCloudPatternOpen((open) => !open)}
                >
                  <span className={styles.weatherBoxHeader}>
                    <span>{t("sailing.cloudDevelopment")}</span>
                    <ChevronDown className={styles.cloudToggleIcon} aria-hidden size={15} />
                  </span>
                  <span className={styles.weatherValueRow}>
                    <span
                      className={`${styles.weatherIcon} ${weatherIconClass}`}
                      aria-hidden
                    >
                      <span />
                      <span />
                      <span />
                    </span>
                    <span className={styles.weatherCloudText}>
                      <strong>{weatherStateLabel}</strong>
                      <small>
                        {cloudCoverValue} {t("sailing.cloudCover")}
                      </small>
                    </span>
                  </span>
                  <small>{cloudTrendText}</small>
                  {cloudPatternOpen && (
                    <span id="cloud-forecast-pattern" className={styles.cloudPattern}>
                      <span className={styles.cloudPatternTitle}>
                        {t("sailing.cloudPatternTitle")}
                      </span>
                      {cloudPatternRows.length ? (
                        <span className={styles.cloudPatternBars}>
                          {cloudPatternRows.map((forecast) => (
                            <span key={forecast.key} className={styles.cloudPatternPoint}>
                              <span
                                className={`${styles.cloudPatternIcon} ${forecast.iconClass}`}
                                aria-hidden
                              >
                                <span />
                                <span />
                                <span />
                              </span>
                              <span>{forecast.time}</span>
                              <small>{forecast.cloudCover}</small>
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className={styles.cloudPatternEmpty}>{noForecastLabel}</span>
                      )}
                    </span>
                  )}
                </button>
              </div>
            </div>

            <div className={styles.instrumentGrid}>
              <div className={styles.instrument}>
                <div className={styles.instrumentReadout}>
                  <span>{t("sailing.windSpeed")}</span>
                  <small>Datenpunkt: {stationName}</small>
                </div>
                <div
                  className={styles.gaugeDial}
                  role="img"
                  aria-label={windSpeedTooltip}
                  tabIndex={0}
                  style={{
                    "--gauge-angle": `${gaugeAngle}deg`,
                  }}
                >
                  {SPEED_TICKS.map((tick) => (
                    <span
                      key={`speed-tick-${tick.value}`}
                      className={`${styles.speedTick}${
                        tick.major ? ` ${styles.speedTickMajor}` : ""
                      }`}
                      aria-hidden
                      style={{"--tick-angle": `${tick.angle}deg`}}
                    />
                  ))}
                  {SPEED_MARKS.map((mark) => (
                    <span
                      key={`speed-mark-${mark.value}`}
                      className={styles.speedMark}
                      aria-hidden
                      style={{
                        "--mark-angle": `${mark.angle}deg`,
                        "--mark-counter-angle": `${-mark.angle}deg`,
                      }}
                    >
                      {mark.value}
                    </span>
                  ))}
                  <div className={styles.gaugeNeedle} aria-hidden />
                  <div className={styles.forecastTooltip} aria-hidden>
                    <strong>{forecastLabel}</strong>
                    {forecastRows.length ? (
                      <div className={styles.forecastTable}>
                        <span>{t("sailing.forecastTime")}</span>
                        <span>{t("sailing.windSpeed")}</span>
                        <span>{t("sailing.windGusts")}</span>
                        {forecastRows.map((forecast) => (
                          <span
                            key={`speed-forecast-${forecast.time}`}
                            className={styles.forecastRow}
                          >
                            <span>{forecast.time}</span>
                            <span>{forecast.speed}</span>
                            <span>{forecast.gusts}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.forecastEmpty}>{noForecastLabel}</span>
                    )}
                  </div>
                </div>
                <p className={`${styles.instrumentMeta} ${styles.windMeta}`}>
                  <span>
                    {t("sailing.windSpeed")}: <strong>{windSpeedValue} kn</strong>
                  </span>
                  <span>
                    {t("sailing.windGusts")}: <strong>{windGustValue} kn</strong>
                  </span>
                </p>
              </div>

              <div className={styles.instrument}>
                <div className={styles.instrumentReadout}>
                  <span>{t("sailing.windDirection")}</span>
                  <small>Datenpunkt: {stationName}</small>
                </div>
                <div
                  className={styles.compassDial}
                  role="img"
                  aria-label={compassTooltip}
                  tabIndex={0}
                  style={{"--direction": `${direction ?? 0}deg`}}
                >
                  {COMPASS_TICKS.map((tick) => (
                    <span
                      key={`compass-tick-${tick.angle}`}
                      className={`${styles.compassTick}${
                        tick.major ? ` ${styles.compassTickMajor}` : ""
                      }`}
                      aria-hidden
                      style={{"--tick-angle": `${tick.angle}deg`}}
                    />
                  ))}
                  <span className={`${styles.compassLabel} ${styles.north}`}>N</span>
                  <span className={`${styles.compassLabel} ${styles.east}`}>E</span>
                  <span className={`${styles.compassLabel} ${styles.south}`}>S</span>
                  <span className={`${styles.compassLabel} ${styles.west}`}>W</span>
                  <div className={styles.compassNeedle} data-empty={direction == null} />
                  <div className={styles.forecastTooltip} aria-hidden>
                    <strong>{forecastLabel}</strong>
                    {forecastRows.length ? (
                      <div className={styles.forecastTable}>
                        <span>{t("sailing.forecastTime")}</span>
                        <span>{t("sailing.windDirection")}</span>
                        <span>{t("sailing.windSpeed")}</span>
                        {forecastRows.map((forecast) => (
                          <span
                            key={`direction-forecast-${forecast.time}`}
                            className={styles.forecastRow}
                          >
                            <span>{forecast.time}</span>
                            <span>{forecast.direction}</span>
                            <span>{forecast.speed}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className={styles.forecastEmpty}>{noForecastLabel}</span>
                    )}
                  </div>
                </div>
                <p className={styles.instrumentMeta}>
                  {t("sailing.windDirection")}: <strong>{windDirectionValue}</strong>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={styles.sourceRow}>
          <span>{t("sailing.sources")}</span>
          <a href="https://open-meteo.com/en/docs" target="_blank" rel="noreferrer">
            {t("sailing.source")}
          </a>
          <a
            href="https://www.gkd.bayern.de/de/seen/wassertemperatur/inn/stock-18400503/messwerte/tabelle"
            target="_blank"
            rel="noreferrer"
          >
            {t("sailing.waterSource")}
          </a>
        </div>
      </div>

      <div className={styles.webcamPanel}>
        <div className={styles.webcamCopy}>
          <p className={styles.panelEyebrow}>{t("sailing.webcamTitle")}</p>
          <h3>{t("sailing.webcamSubtitle")}</h3>
          <div className={styles.webcamLinks}>
            <a href={CYC_WEBCAM_URL} target="_blank" rel="noreferrer">
              {t("sailing.webcamSource")}
            </a>
            <a href={WETTER_WEBCAM_URL} target="_blank" rel="noreferrer">
              {t("sailing.liveSource")}
            </a>
          </div>
        </div>
        <div className={styles.webcamFrame} aria-busy={shouldShowWebcamSkeleton}>
          {!isConsentReady ? (
            <div
              className={styles.webcamSkeleton}
              role="status"
              aria-label={t("sailing.webcamLoading", {
                defaultValue: "Loading webcam",
              })}
            >
              <span />
              <span />
              <span />
            </div>
          ) : !allowExternalServices ? (
            <div className={styles.webcamFallback}>
              <p>{tConsent("externalServicesBlocked")}</p>
              <button onClick={openConsentSettings} type="button">
                {tConsent("actions.manage")}
              </button>
            </div>
          ) : webcamAvailable ? (
            <>
              {shouldShowWebcamSkeleton && (
                <div
                  className={styles.webcamSkeleton}
                  role="status"
                  aria-label={t("sailing.webcamLoading", {
                    defaultValue: "Loading webcam",
                  })}
                >
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <Image
                src={webcamSrc}
                alt={t("sailing.webcamTitle")}
                className={styles.webcamImage}
                fill
                loading="lazy"
                sizes="(max-width: 980px) 100vw, 58vw"
                unoptimized
                onError={() => {
                  setWebcamAvailable(false);
                  setWebcamImageReady(false);
                }}
                onLoad={() => {
                  setWebcamAvailable(true);
                  setWebcamImageReady(true);
                }}
              />
            </>
          ) : (
            <div className={styles.webcamFallback}>
              <p>{t("sailing.webcamUnavailable")}</p>
              <a href={CYC_WEBCAM_URL} target="_blank" rel="noreferrer">
                {t("sailing.openWebcam")}
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default PersonalSection;
