const {useEffect, useRef} = require("react");
const {useTranslation} = require("react-i18next");
import mapboxgl from "mapbox-gl";
import styles from "./experience-map.module.css";

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

const ExperienceMap = ({labels}) => {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const {t} = useTranslation();

  useEffect(() => {
    if (!token || !mapContainer.current) return;
    if (mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [25, 20],
      projection: {name: "mercator"},
      zoom: 1.3,
    });

    const map = mapRef.current;
    map.on("load", () => {
      // Hide the default country labels to avoid duplicate text over our filled regions.
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
  }, [token]);

  if (!token) {
    return (
      <div className={styles.mapFallback}>
        <p>{labels.missingToken}</p>
      </div>
    );
  }

  return (
    <section id="map" className={styles.section}>
      <div className={styles.sectionHeader}>
        <p className={styles.eyebrow}>{t("map.title")}</p>
        <h2>{t("map.title")}</h2>

        <div className={styles.mapShell}>
          <div ref={mapContainer} className={styles.map} />
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
        </div>
      </div>
    </section>
  );
};

export default ExperienceMap;
