import {useEffect, useRef} from "react";
import {useTranslation} from "react-i18next";
import mapboxgl from "mapbox-gl";

import {useInViewOnce} from "@/lib/useInViewOnce";
import pageStyles from "../../page.module.css";
import styles from "./skills-section.module.css";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

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
  {all: [], lived: [], worked: []}
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

const SkillsSection = ({skills}) => {
  const {t} = useTranslation(undefined, {keyPrefix: "skills"});
  const [sectionRef, isInView] = useInViewOnce({
    threshold: 0.35,
    rootMargin: "0px 0px -20% 0px",
  });
  const [mapRefObserver, mapInView] = useInViewOnce({
    threshold: 0.2,
    rootMargin: "0px 0px -10% 0px",
  });
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const levelForScore = (score) => {
    if (score <= 4) return "support";
    if (score <= 8) return "lead";
    return "own";
  };

  const industries = t("industries", {
    returnObjects: true,
    defaultValue: [],
  });

  useEffect(() => {
    if (!mapInView || !token || !mapContainer.current) return;
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [-95, 35],
      projection: {name: "globe"},
      zoom: 1.6,
    });

    const map = mapRef.current;
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
        data: labelFeatures,
      });
      map.addLayer({
        id: "lived-fill",
        type: "fill",
        source: "country-boundaries",
        "source-layer": "country_boundaries",
        filter: [
          "in",
          ["get", "iso_3166_1_alpha_3"],
          ["literal", regionCodes.lived],
        ],
        paint: {
          "fill-color": "#86ffb6",
          "fill-opacity": 0.3,
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
          ["literal", regionCodes.worked],
        ],
        paint: {
          "fill-color": "#7dd2ff",
          "fill-opacity": 0.3,
        },
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
          "text-optional": false,
          "symbol-placement": "point",
          "symbol-sort-key": [
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
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapInView, token]);

  return (
    <section id="skills" className={pageStyles.section} ref={sectionRef}>
      <div className={pageStyles.sectionHeader}>
        <p className={pageStyles.eyebrow}>{t("title")}</p>
        <h2>{t("headline")}</h2>
        <p className={pageStyles.lead}>{t("description")}</p>
      </div>
      <div className={styles.skills}>
        {skills.map((skill, idx) => {
          const level = levelForScore(skill.score || 0);
          const clamped = Math.min(Math.max(skill.score, 0), 10);
          const fillScale = clamped / 10;
          return (
            <div key={skill.label} className={styles.skill}>
              <div className={styles.skillTop}>
                <div>
                  <span className={styles.label}>{skill.label}</span>
                  {skill.detail && (
                    <p className={styles.detail}>{skill.detail}</p>
                  )}
                </div>
                {/* <span className={styles.level}>
                  {t(`skills.levels.${level}`)}
                </span> */}
              </div>
              <div className={styles.skillBar}>
                <div
                  className={styles.skillFill}
                  data-active={isInView}
                  data-label={t(`levels.${level}`)}
                  style={{
                    "--fill-scale": fillScale,
                    "--animation-delay": `${idx * 0.08}s`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className={styles.legend}>
        <span>{t("levels.support")}</span>
        <span>{t("levels.lead")}</span>
        <span>{t("levels.own")}</span>
      </div>

      <div className={styles.flashcardsHeader}>
        <h2>{t("industriesTitle")}</h2>
      </div>

      <div className={styles.flashcards}>
        {industries.map((card, idx) => (
          <div key={`${card.title}-${idx}`} className={styles.flashcard}>
            <div className={styles.flashcardHeader}>
              <span className={styles.flashcardIcon}>{card.icon}</span>
              <h4>{card.title}</h4>
            </div>
            <p>{card.detail}</p>
          </div>
        ))}
      </div>

      <div className={styles.mapSection}>
        <div className={styles.mapSectionHeader}>
          <p className={styles.mapEyebrow}>{t("map.eyebrow")}</p>
          <h2>{t("map.title")}</h2>
          <p className={pageStyles.lead}>{t("map.subtitle")}</p>
        </div>

        <div className={styles.mapShell}>
          {token ? (
            <>
              <div ref={mapRefObserver}>
                <div ref={mapContainer} className={styles.map} />
              </div>
              <div className={styles.mapLegend}>
                <span>
                  <span className={`${styles.dot} ${styles.dotLived}`} />
                  {t("map.lived")}
                </span>
                <span>
                  <span className={`${styles.dot} ${styles.dotWorked}`} />
                  {t("map.worked")}
                </span>
              </div>
            </>
          ) : (
            <div className={styles.mapFallback}>
              <p>{t("map.missingToken")}</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SkillsSection;
