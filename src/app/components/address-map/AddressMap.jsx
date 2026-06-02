"use client";

import mapboxgl from "mapbox-gl";
import {usePathname} from "next/navigation";
import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";

import "../../../lib/i18n";
import {useCookieConsent} from "../consent/CookieConsent";
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

function getStaticMapStylePath(styleUrl) {
  const match = String(styleUrl || "").match(
    /^mapbox:\/\/styles\/([^/]+)\/([^/]+)$/i,
  );

  if (!match) return "mapbox/light-v11";

  return `${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`;
}

function getStaticMapImageUrl({latitude, longitude, markerColor, styleUrl, token, zoom}) {
  const color = String(markerColor || "#5867f3")
    .replace("#", "")
    .replace(/[^A-Fa-f0-9]/g, "")
    .slice(0, 6);
  const pinColor = color || "5867f3";
  const lon = longitude.toFixed(5);
  const lat = latitude.toFixed(5);
  const stylePath = getStaticMapStylePath(styleUrl);
  const staticZoom = Number.isFinite(zoom) ? zoom.toFixed(1) : "14.0";

  return `https://api.mapbox.com/styles/v1/${stylePath}/static/pin-s+${pinColor}(${lon},${lat})/${lon},${lat},${staticZoom},0/1280x640@2x?access_token=${encodeURIComponent(token)}`;
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
  const pathname = usePathname();
  const {t} = useTranslation(undefined, {keyPrefix: "cookieConsent"});
  const {allowExternalServices, openConsentSettings} = useCookieConsent();
  const [containerNode, setContainerNode] = useState(null);
  const [loadedMapKey, setLoadedMapKey] = useState("");
  const [mapErrorKey, setMapErrorKey] = useState("");
  const handleContainerRef = useCallback((node) => {
    setContainerNode(node);
  }, []);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
  const longitude = getCoordinate(address?.longitude);
  const latitude = getCoordinate(address?.latitude);
  const consentRequired = !pathname?.startsWith("/admin");
  const canUseExternalServices = !consentRequired || allowExternalServices;
  const canRenderMap = Boolean(
    canUseExternalServices && token && hasValidCoordinates(longitude, latitude)
  );
  const markerColor = "#5867f3";
  const mapKey = canRenderMap
    ? [longitude, latitude, styleUrl, zoom, token].join("|")
    : "";
  const isMapReady = Boolean(
    mapKey && loadedMapKey === mapKey && mapErrorKey !== mapKey,
  );
  const staticMapImageUrl = canRenderMap
    ? getStaticMapImageUrl({
        latitude,
        longitude,
        markerColor,
        styleUrl,
        token,
        zoom,
      })
    : "";

  useEffect(() => {
    if (!canRenderMap || !containerNode) return undefined;

    mapboxgl.accessToken = token;

    let map;
    try {
      map = new mapboxgl.Map({
        attributionControl: false,
        center: [longitude, latitude],
        container: containerNode,
        interactive,
        pitch: 0,
        style: styleUrl,
        zoom,
      });
    } catch (error) {
      queueMicrotask(() => {
        setMapErrorKey(mapKey);
      });
      console.warn("Unable to render address map.", error);
      return undefined;
    }

    const resizeFrame = window.requestAnimationFrame(() => {
      map.resize();
    });
    const computedMarkerColor =
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || markerColor;

    const marker = new mapboxgl.Marker({color: computedMarkerColor, scale: markerScale})
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
      setLoadedMapKey(mapKey);
      setMapErrorKey((currentKey) => (currentKey === mapKey ? "" : currentKey));
    });
    map.on("error", (event) => {
      setMapErrorKey(mapKey);
      console.warn("Unable to render address map.", event?.error || event);
    });

    return () => {
      window.cancelAnimationFrame(resizeFrame);
      marker.remove();
      map.remove();
    };
  }, [
    canRenderMap,
    containerNode,
    interactive,
    latitude,
    longitude,
    mapKey,
    markerColor,
    markerScale,
    styleUrl,
    token,
    zoom,
  ]);

  if (!address?.label) {
    return null;
  }

  if (!canUseExternalServices) {
    return (
      <div className={`${styles.mapRoot} ${styles.placeholder} ${className}`}>
        <span>{t("externalServicesBlocked")}</span>
        <button onClick={openConsentSettings} type="button">
          {t("actions.manage")}
        </button>
      </div>
    );
  }

  if (!canRenderMap) {
    return (
      <div className={`${styles.mapRoot} ${styles.placeholder} ${className}`}>
        <span>Map preview unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={`${styles.mapRoot} ${className}`}
      aria-label={label}
      data-map-ready={isMapReady ? "true" : "false"}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        className={styles.staticMap}
        decoding="async"
        loading="lazy"
        src={staticMapImageUrl}
      />
      <div className={styles.mapCanvas} ref={handleContainerRef} />
    </div>
  );
}
