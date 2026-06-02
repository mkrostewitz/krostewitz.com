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

  useEffect(() => {
    if (!canRenderMap || !containerNode) return undefined;

    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      attributionControl: false,
      center: [longitude, latitude],
      container: containerNode,
      interactive,
      pitch: 0,
      style: styleUrl,
      zoom,
    });
    const resizeFrame = window.requestAnimationFrame(() => {
      map.resize();
    });
    const markerColor =
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim() || "#5867f3";

    const marker = new mapboxgl.Marker({color: markerColor, scale: markerScale})
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
    <div className={`${styles.mapRoot} ${className}`} aria-label={label}>
      <div className={styles.mapCanvas} ref={handleContainerRef} />
    </div>
  );
}
