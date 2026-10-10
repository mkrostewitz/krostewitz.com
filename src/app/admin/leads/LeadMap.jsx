"use client";

import mapboxgl from "mapbox-gl";
import {useEffect, useMemo, useRef, useState} from "react";
import styles from "../admin.module.css";
import {formatAddress, hasAddressCoordinates} from "../../lib/leadAddress.mjs";

function leadTitle(lead) { return lead.name || lead.email || "Contact"; }

function getLeadCoordinates(lead) {
  const address = lead?.address;
  if (hasAddressCoordinates(address)) {
    return [address.longitude, address.latitude];
  }
  if (lead?.location || formatAddress(address || {})) return null;
  if ([lead?.tracking?.longitude, lead?.tracking?.latitude].some((value) => value == null || value === "")) return null;
  const longitude = Number(lead?.tracking?.longitude);
  const latitude = Number(lead?.tracking?.latitude);

  if (
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude) ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    return null;
  }

  return [longitude, latitude];
}

function getLeadLocationQuery(lead) {
  const tracking = lead?.tracking || {};

  return (
    formatAddress(lead.address || {}) || lead.location || tracking.address ||
    [tracking.city, tracking.state, tracking.country].filter(Boolean).join(", ") ||
    [tracking.state, tracking.country].filter(Boolean).join(", ") ||
    tracking.country ||
    ""
  );
}

export default function LeadMap({activeLeadId, leads, onSelectLead = () => {}, geocode = true, emptyMessage}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [resolvedCoordinates, setResolvedCoordinates] = useState({});
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const mappedLeads = useMemo(
    () =>
      leads
        .map((lead) => {
          const directCoordinates = getLeadCoordinates(lead);
          const query = getLeadLocationQuery(lead);
          const resolved = resolvedCoordinates[lead.id];
          const fallbackCoordinates =
            resolved?.query === query ? resolved.coordinates : null;

          return {
            lead,
            coordinates: directCoordinates || fallbackCoordinates,
          };
        })
        .filter((item) => item.coordinates),
    [leads, resolvedCoordinates]
  );
  const geocodeTargets = useMemo(
    () =>
      leads
        .map((lead) => ({
          lead,
          coordinates: getLeadCoordinates(lead),
          query: getLeadLocationQuery(lead),
          resolved: resolvedCoordinates[lead.id],
        }))
        .filter(
          (item) =>
            !item.coordinates &&
            item.query &&
            item.resolved?.query !== item.query
        ),
    [leads, resolvedCoordinates]
  );
  const coordinatesKey = mappedLeads
    .map((item) => `${item.lead.id}:${item.coordinates.join(",")}`)
    .join("|");

  useEffect(() => {
    if (!geocode || !token || geocodeTargets.length === 0) return undefined;

    const controller = new AbortController();

    async function resolveLocations() {
      const results = await Promise.all(
        geocodeTargets.map(async ({lead, query}) => {
          try {
            const response = await fetch(
              `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
                query
              )}.json?access_token=${encodeURIComponent(token)}&limit=1`,
              {signal: controller.signal}
            );
            const data = await response.json().catch(() => ({}));
            const center = data.features?.[0]?.center;
            const coordinates =
              response.ok &&
              Array.isArray(center) &&
              center.length >= 2 &&
              Number.isFinite(Number(center[0])) &&
              Number.isFinite(Number(center[1]))
                ? [Number(center[0]), Number(center[1])]
                : null;

            return {leadId: lead.id, query, coordinates};
          } catch (error) {
            if (error?.name === "AbortError") return null;
            return {leadId: lead.id, query, coordinates: null};
          }
        })
      );

      if (controller.signal.aborted) return;

      setResolvedCoordinates((current) => {
        const next = {...current};

        for (const result of results) {
          if (!result) continue;
          next[result.leadId] = {
            query: result.query,
            coordinates: result.coordinates,
          };
        }

        return next;
      });
    }

    void resolveLocations();

    return () => {
      controller.abort();
    };
  }, [geocodeTargets, token, geocode]);

  const hasMappedLeads = mappedLeads.length > 0;
  const centerLongitude = mappedLeads[0]?.coordinates[0];
  const centerLatitude = mappedLeads[0]?.coordinates[1];
  useEffect(() => {
    if (!token || !containerRef.current || mapRef.current || !hasMappedLeads) {
      return undefined;
    }

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      attributionControl: false,
      center: [centerLongitude, centerLatitude],
      container: containerRef.current,
      pitch: 0,
      style: "mapbox://styles/mapbox/light-v11",
      zoom: 12,
    });

    map.addControl(
      new mapboxgl.AttributionControl({compact: true}),
      "bottom-right"
    );
    map.addControl(
      new mapboxgl.NavigationControl({showCompass: false}),
      "top-right"
    );

    mapRef.current = map;
    // The address section can open without a window resize.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    map.on("load", () => {
      map.resize();
    });
    map.on("error", () => {
      console.warn("Unable to render lead map.");
    });

    return () => {
      resizeObserver.disconnect();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [hasMappedLeads, centerLongitude, centerLatitude, token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return undefined;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = mappedLeads.map(({lead, coordinates}) => {
      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.setAttribute("role", "button");
      markerElement.className = `${styles.leadMapMarker} ${
        lead.id === activeLeadId ? styles.leadMapMarkerActive : ""
      }`;
      markerElement.title = leadTitle(lead);
      markerElement.setAttribute("aria-label", `Select ${leadTitle(lead)}`);
      markerElement.addEventListener("click", () => onSelectLead(lead.id));

      return new mapboxgl.Marker({anchor: "bottom", element: markerElement})
        .setLngLat(coordinates)
        .addTo(map);
    });

    if (mappedLeads.length === 1) {
      map.easeTo({center: mappedLeads[0].coordinates, zoom: 12, duration: 0});
    } else if (mappedLeads.length > 1) {
      const bounds = mappedLeads.reduce(
        (nextBounds, item) => nextBounds.extend(item.coordinates),
        new mapboxgl.LngLatBounds(mappedLeads[0].coordinates, mappedLeads[0].coordinates)
      );
      map.fitBounds(bounds, {duration: 0, maxZoom: 8, padding: 54});
    }

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
    };
  }, [activeLeadId, coordinatesKey, mappedLeads, onSelectLead]);

  useEffect(() => {
    const map = mapRef.current;
    const activeItem = mappedLeads.find((item) => item.lead.id === activeLeadId);

    if (!map || !activeItem) return;

    map.easeTo({
      center: activeItem.coordinates,
      duration: 350,
      zoom: Math.max(map.getZoom(), 5),
    });
  }, [activeLeadId, mappedLeads]);

  if (!token) {
    return (
      <div className={styles.leadMapPlaceholder}>
        Map unavailable. Configure `NEXT_PUBLIC_MAPBOX_TOKEN`.
      </div>
    );
  }

  if (mappedLeads.length === 0) {
    return (
      <div className={styles.leadMapPlaceholder}>
        {emptyMessage || (geocode && geocodeTargets.length > 0
          ? "Resolving lead locations..."
          : "No location data is available for the current leads.")}
      </div>
    );
  }

  return (
    <div className={styles.leadMap} aria-label="Lead locations">
      <div className={styles.leadMapCanvas} ref={containerRef} />
    </div>
  );
}
