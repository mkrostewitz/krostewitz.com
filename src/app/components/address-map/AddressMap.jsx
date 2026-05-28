"use client";

import mapboxgl from "mapbox-gl";
import {useEffect, useRef} from "react";

import styles from "./address-map.module.css";

function getCoordinate(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function hasValidCoordinates(longitude, latitude) {
  return (
    longitude !== null &&
    latitude !== null &&
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

export default function AddressMap({
  address,
  className = "",
  interactive = false,
  label = "Address map",
  markerScale = 0.9,
  styleUrl = "mapbox://styles/mapbox/light-v11",
  zoom = 14,
}) {
  const containerRef = useRef(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const longitude = getCoordinate(address?.longitude);
  const latitude = getCoordinate(address?.latitude);
  const canRenderMap = Boolean(
    token && hasValidCoordinates(longitude, latitude)
  );

  useEffect(() => {
    if (!canRenderMap || !containerRef.current) return undefined;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      attributionControl: false,
      center: [longitude, latitude],
      container: containerRef.current,
      interactive,
      pitch: 0,
      style: styleUrl,
      zoom,
    });

    const marker = new mapboxgl.Marker({color: "#5867f3", scale: markerScale})
      .setLngLat([longitude, latitude])
      .addTo(map);

    map.addControl(
      new mapboxgl.AttributionControl({compact: true}),
      "bottom-right"
    );

    if (interactive) {
      map.addControl(
        new mapboxgl.NavigationControl({showCompass: false}),
        "top-right"
      );
    }

    map.on("load", () => {
      map.resize();
    });
    map.on("error", () => {
      console.warn("Unable to render address map.");
    });

    return () => {
      marker.remove();
      map.remove();
    };
  }, [
    canRenderMap,
    interactive,
    latitude,
    longitude,
    markerScale,
    styleUrl,
    token,
    zoom,
  ]);

  if (!address?.label) {
    return null;
  }

  if (!canRenderMap) {
    return (
      <div className={`${styles.mapRoot} ${styles.placeholder} ${className}`}>
        <span>Map preview unavailable</span>
      </div>
    );
  }

  return (
    <div className={`${styles.mapRoot} ${className}`} aria-label={label}>
      <div className={styles.mapCanvas} ref={containerRef} />
    </div>
  );
}
