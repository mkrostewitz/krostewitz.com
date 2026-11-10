"use client";

import {forwardRef, useEffect, useRef, useState} from "react";
import {experienceMapData} from "../../lib/experienceMap.mjs";
import mapboxgl from "mapbox-gl";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

const DEFAULT_CENTER = [0, 35];
const DEFAULT_SPIN_SPEED = 2.8;

const mapRegions = [
  {name: "Germany", iso3: "DEU", status: "lived", center: [10.5, 51.2]},
  {name: "United States", iso3: "USA", status: "lived", center: [-98.6, 39.5]},
  {name: "China", iso3: "CHN", status: "lived", center: [103.8, 35.7]},
  {name: "Hong Kong SAR", iso3: "HKG", status: "lived", center: [114.2, 22.3]},
  {name: "India", iso3: "IND", status: "worked", center: [78.96, 22.1]},
  {name: "Mexico", iso3: "MEX", status: "worked", center: [-102, 23.6]},
  {name: "Thailand", iso3: "THA", status: "worked", center: [100.9925, 15.87]},
  {
    name: "Singapore",
    iso3: "SGP",
    status: "worked",
    center: [103.8198, 1.3521],
  },
  {name: "Vietnam", iso3: "VNM", status: "worked", center: [108.2772, 14.0583]},
  {
    name: "Bangladesh",
    iso3: "BGD",
    status: "worked",
    center: [90.3563, 23.685],
  },
  {name: "Japan", iso3: "JPN", status: "worked", center: [138.2529, 36.2048]},
  {
    name: "South Korea",
    iso3: "KOR",
    status: "worked",
    center: [127.7669, 35.9078],
  },
  {
    name: "United Arab Emirates",
    iso3: "ARE",
    status: "worked",
    center: [54.3, 23.4],
  },
  {name: "Australia", iso3: "AUS", status: "worked", center: [134, -25.3]},
];

const regionCodes = mapRegions.reduce(
  (acc, region) => {
    acc.all.push(region.iso3);
    acc[region.status].push(region.iso3);
    return acc;
  },
  {all: [], lived: [], worked: []},
);

const labelFeatures = {
  type: "FeatureCollection",
  features: mapRegions.map((region) => ({
    type: "Feature",
    properties: {
      name: region.name,
      iso3: region.iso3,
      status: region.status,
    },
    geometry: {type: "Point", coordinates: region.center},
  })),
};

const SkillsMap = forwardRef(function SkillsMap(
  {
    allowExternalServices,
    attributionControl = true,
    autoSpin = false,
    center = DEFAULT_CENTER,
    className,
    interactive = true,
    experienceCountries,
    initialCountry,
    onCountrySelect,
    isActive = true,
    mapClassName,
    showSkeleton = true,
    skeletonClassName,
    skeletonLabel = "Loading experience map",
    spinSpeed = DEFAULT_SPIN_SPEED,
    zoom = 1,
  },
  ref,
) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const countrySelectRef = useRef(onCountrySelect);
  useEffect(() => { countrySelectRef.current = onCountrySelect; }, [onCountrySelect]);
  const [mapReady, setMapReady] = useState(false);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const shouldShowSkeleton = Boolean(
    showSkeleton && (!token || !allowExternalServices || !mapReady),
  );

  useEffect(() => {
    if (
      !token ||
      !allowExternalServices ||
      !isActive ||
      !mapContainer.current
    ) {
      return undefined;
    }
    if (mapRef.current) return undefined;

    mapboxgl.accessToken = token;
    mapRef.current = new mapboxgl.Map({
      attributionControl,
      center: experienceCountries ? [0, 15] : center,
      container: mapContainer.current,
      interactive,
      projection: {name: experienceCountries ? "globe" : "mercator"},
      renderWorldCopies: experienceCountries ? false : true,
      minZoom: experienceCountries ? -2 : 0,
      style: "mapbox://styles/mapbox/dark-v11",
      zoom: experienceCountries ? 0 : zoom,
    });

    const map = mapRef.current;
    let overviewBounds;
    let overviewCenter;
    let userMoved = false;
    const markInteraction = event => {
      // Mapbox also emits movement for window resizes; those should refit.
      if (event.originalEvent?.type === "resize") return;
      // Scroll-zoom movement events can omit originalEvent.
      if (event.originalEvent || [map.scrollZoom, map.dragPan, map.dragRotate,
        map.boxZoom, map.doubleClickZoom, map.keyboard, map.touchZoomRotate]
        .some(handler => handler.isActive())) userMoved = true;
    };
    map.on("movestart", markInteraction);
    const canvas = map.getCanvas();
    let globeDrag;
    let clickStart;
    let dragged = false;
    const startGlobeDrag = event => {
      clickStart = {x: event.clientX, y: event.clientY};
      dragged = false;
      if (!experienceCountries || !interactive || event.pointerType !== "mouse" ||
          event.button !== 0 || event.ctrlKey || map.getZoom() >= 5) return;
      event.preventDefault();
      map.stop();
      userMoved = true;
      globeDrag = {
        id: event.pointerId, x: event.clientX, y: event.clientY,
        center: map.getCenter(), panEnabled: map.dragPan.isEnabled(),
        cursor: canvas.style.cursor,
        degreesPerPixel: 180 / Math.min(canvas.clientWidth, canvas.clientHeight) /
          Math.pow(2, Math.max(0, map.getZoom() - 1)),
      };
      // Keep the sphere centered: left-drag changes its viewing longitude and
      // latitude directly, without Mapbox's geographic pan/inertia gesture.
      map.dragPan.disable();
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const turnGlobe = event => {
      if (!globeDrag || event.pointerId !== globeDrag.id) return;
      if (Math.hypot(event.clientX - globeDrag.x, event.clientY - globeDrag.y) > 4) dragged = true;
      const longitude = globeDrag.center.lng - (event.clientX - globeDrag.x) * globeDrag.degreesPerPixel;
      const latitude = globeDrag.center.lat + (event.clientY - globeDrag.y) * globeDrag.degreesPerPixel;
      map.jumpTo({center: [((longitude + 180) % 360 + 360) % 360 - 180,
        Math.max(-85, Math.min(85, latitude))]});
    };
    const endGlobeDrag = event => {
      if (!globeDrag || event.pointerId !== globeDrag.id) return;
      if (globeDrag.panEnabled) map.dragPan.enable();
      canvas.style.cursor = globeDrag.cursor;
      globeDrag = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    };
    const selectCountry = event => {
      if (!experienceCountries || !interactive || dragged || !clickStart ||
          Math.hypot(event.clientX - clickStart.x, event.clientY - clickStart.y) > 4 ||
          !map.getLayer("experience-country-hit")) return;
      const rect = canvas.getBoundingClientRect();
      const features = map.queryRenderedFeatures([event.clientX - rect.left, event.clientY - rect.top],
        {layers: ["experience-labels", "experience-country-hit"]});
      const country = features.map(feature => experienceCountries.find(item =>
        item.id === (feature.properties.countryId || feature.properties.iso_3166_1))).find(Boolean);
      if (country) countrySelectRef.current?.(country);
    };
    canvas.addEventListener("click", selectCountry);
    canvas.addEventListener("pointerdown", startGlobeDrag);
    canvas.addEventListener("pointermove", turnGlobe);
    canvas.addEventListener("pointerup", endGlobeDrag);
    canvas.addEventListener("pointercancel", endGlobeDrag);
    canvas.addEventListener("lostpointercapture", endGlobeDrag);
    const fitOverview = () => {
      if (!overviewBounds || userMoved) return;
      const [[west, south], [east, north]] = overviewBounds;
      const {clientWidth: width, clientHeight: height} = map.getContainer();
      if (width <= 48 || height <= 48) return;
      // Start from the Experience bounds, then size the sphere itself. A flat
      // bounds fit cannot show both hemispheres of an interactive globe.
      map.jumpTo({center: overviewCenter || [(west + east) / 2, (south + north) / 2], zoom: 0});
      for (let attempt = 0; attempt < 4; attempt += 1) {
        let radiusX = 0, radiusY = 0;
        for (let latitude = -90; latitude <= 90; latitude += 10) {
          for (let longitude = -180; longitude <= 180; longitude += 10) {
            const point = map.project([longitude, latitude]);
            radiusX = Math.max(radiusX, Math.abs(point.x - width / 2));
            radiusY = Math.max(radiusY, Math.abs(point.y - height / 2));
          }
        }
        const scale = Math.min((width / 2 - 24) / radiusX, (height / 2 - 24) / radiusY);
        if (!Number.isFinite(scale) || Math.abs(scale - 1) < 0.01) break;
        map.setZoom(Math.max(-2, Math.min(2, map.getZoom() + Math.log2(scale))));
      }
    };
    const resizeObserver = new ResizeObserver(() => {
      map.resize();
      fitOverview();
    });
    resizeObserver.observe(mapContainer.current);

    map.on("load", () => {
      const layers = map.getStyle().layers || [];
      layers.forEach((layer) => {
        if (layer.type === "symbol" && layer.id.includes("country")) {
          map.setLayoutProperty(layer.id, "visibility", "none");
        }
      });

      map.addSource("country-boundaries", {
        type: "vector",
        url: "mapbox://mapbox.country-boundaries-v1",
      });
      map.addSource("experience-labels", {
        type: "geojson",
        data: experienceCountries ? {type: "FeatureCollection", features: []} : labelFeatures,
      });
      map.addLayer({
        id: "lived-fill",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: [
          "in",
          ["get", "iso_3166_1_alpha_3"],
          ["literal", experienceCountries ? [] : regionCodes.lived],
        ],
        paint: {
          "fill-color": "#86ffb6",
          "fill-opacity": experienceCountries ? 0.55 : 0.3,
        },
      });
      map.addLayer({
        id: "worked-fill",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: [
          "in",
          ["get", "iso_3166_1_alpha_3"],
          ["literal", experienceCountries ? [] : regionCodes.worked],
        ],
        paint: {
          "fill-color": "#7dd2ff",
          "fill-opacity": experienceCountries ? 0.55 : 0.3,
        },
      });
      if (experienceCountries) map.addLayer({
        id: "experience-country-hit",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: ["in", ["get", "iso_3166_1"], ["literal", experienceCountries.map(country => country.id)]],
        paint: {"fill-opacity": 0},
      });
      map.addLayer({
        id: "experience-labels",
        type: "symbol",
        source: "experience-labels",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-transform": "uppercase",
          "text-letter-spacing": 0.05,
          "text-allow-overlap": false,
          "text-padding": 4,
          ...(experienceCountries ? {
            "text-padding": 6,
            "text-variable-anchor": ["center", "top", "bottom", "left", "right"],
            "text-radial-offset": 0.6,
          } : {}),
          "text-optional": false,
          "symbol-placement": "point",
          "symbol-sort-key": experienceCountries ? [
            "match", ["get", "status"], "lived", 0, "worked", 1, 2,
          ] : [
            "match",
            ["get", "iso3"],
            regionCodes.lived,
            3,
            regionCodes.worked,
            2,
            1,
          ],
        },
        paint: {
          "text-color": "#f7f8fa",
          "text-halo-color": "#0b0f19",
          "text-halo-width": 2,
          "text-halo-blur": 0.4,
        },
      });
      if (experienceCountries) {
        // Read the same boundary source used for highlighting, at the initial
        // global zoom, before fitting. No separate country/coordinate catalog.
        const prepareOverview = () => {
          if (!map.isSourceLoaded("country-boundaries")) return;
          const features = map.querySourceFeatures("country-boundaries", {sourceLayer: "country_boundaries"});
          if (!features.length) return;
          const data = experienceMapData(experienceCountries, features, mapRegions, initialCountry);
          map.setFilter("lived-fill", ["in", ["get", "iso_3166_1"], ["literal", data.lived]]);
          map.setFilter("worked-fill", ["in", ["get", "iso_3166_1"], ["literal", data.worked]]);
          map.getSource("experience-labels").setData(data.labels);
          overviewBounds = data.bounds;
          overviewCenter = data.initialCenter;
          fitOverview();
          map.off("idle", prepareOverview);
          setMapReady(true);
        };
        map.on("idle", prepareOverview);
      } else {
        setMapReady(true);
      }
    });

    map.on("error", () => {
      setMapReady(false);
    });

    return () => {
      canvas.removeEventListener("click", selectCountry);
      canvas.removeEventListener("pointerdown", startGlobeDrag);
      canvas.removeEventListener("pointermove", turnGlobe);
      canvas.removeEventListener("pointerup", endGlobeDrag);
      canvas.removeEventListener("pointercancel", endGlobeDrag);
      canvas.removeEventListener("lostpointercapture", endGlobeDrag);
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [
    allowExternalServices,
    attributionControl,
    center,
    interactive,
    experienceCountries,
    initialCountry,
    isActive,
    token,
    zoom,
  ]);

  useEffect(() => {
    if (!autoSpin || !mapReady || !mapRef.current) {
      return undefined;
    }
    const map = mapRef.current;
    const container = map.getCanvasContainer();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let previousTime = performance.now();
    let resumeAt = 0;
    let visible = !interactive;
    let firstView = true;
    let frameId;
    const visibilityObserver = interactive ? new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      if (visible && firstView) {
        // Let the latest assignment's country remain centered on first view.
        resumeAt = performance.now() + 2500;
        firstView = false;
      }
    }, {threshold: [0, 0.25]}) : null;
    visibilityObserver?.observe(container);
    const pauseForInteraction = () => { resumeAt = performance.now() + 2500; };
    const inputEvents = ["pointerdown", "pointerup", "wheel", "touchstart", "touchend", "keydown"];
    if (interactive) inputEvents.forEach(type => container.addEventListener(type, pauseForInteraction, {passive: true}));

    const spin = timestamp => {
      if (!mapRef.current) return;
      const elapsedSeconds = Math.min((timestamp - previousTime) / 1000, 0.05);
      previousTime = timestamp;
      const readingOrInteracting = interactive && (container.matches(":hover") ||
        map.getCanvas().matches(":focus-visible") || map.isMoving() || timestamp < resumeAt);
      if (visible && !document.hidden && !reducedMotion.matches && !readingOrInteracting) {
        const current = map.getCenter();
        const longitude = ((current.lng + elapsedSeconds * spinSpeed + 540) % 360) - 180;
        map.setCenter([longitude, current.lat]);
      }
      frameId = window.requestAnimationFrame(spin);
    };
    frameId = window.requestAnimationFrame(spin);
    return () => {
      window.cancelAnimationFrame(frameId);
      visibilityObserver?.disconnect();
      inputEvents.forEach(type => container.removeEventListener(type, pauseForInteraction));
    };
  }, [autoSpin, interactive, mapReady, spinSpeed]);

  return (
    <div
      ref={ref}
      className={className}
      data-map-ready={mapReady ? "true" : "false"}
      aria-busy={shouldShowSkeleton || undefined}
    >
      {allowExternalServices && token ? (
        <div ref={mapContainer} className={mapClassName} />
      ) : null}
      {shouldShowSkeleton ? (
        <div
          className={skeletonClassName}
          role="status"
          aria-label={skeletonLabel}
        >
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
      ) : null}
    </div>
  );
});

export default SkillsMap;
