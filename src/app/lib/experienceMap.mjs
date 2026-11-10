import {initialTimelineDates, validTimelineDate, timelineDateInput} from './timelineDates.mjs';

export function latestExperienceCountry(entries, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const dated = entries.flatMap(entry => {
    const dates = initialTimelineDates(entry);
    if (!entry.classifications?.countries?.length || !validTimelineDate(dates.startDate)) return [];
    const start = timelineDateInput(dates.startDate);
    if (start > today || (!dates.current && !validTimelineDate(dates.endDate))) return [];
    const end = dates.current ? today : timelineDateInput(dates.endDate);
    if (end < start) return [];
    return [{countries: entry.classifications.countries, start, end: end > today ? today : end}];
  }).sort((a, b) => b.end.localeCompare(a.end) || b.start.localeCompare(a.start));
  // A multi-country role does not establish which country was visited last.
  const countries = dated[0]?.countries;
  return countries?.length === 1 ? countries[0] : null;
}

// Geometry and ISO mappings come from the existing Mapbox boundary source.
// Country membership comes exclusively from the Experience summary.
export function experienceMapData(countries, features, existingRegions, initialCountry) {
  const assigned = new Map(countries.map(country => [country.id, country]));
  const regions = new Map(existingRegions.map(region => [region.iso3, region]));
  const matched = new Map();
  const countryBounds = new Map();
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
  const extend = (coordinates, bounds) => {
    if (typeof coordinates[0] === "number") {
      const [lng, lat] = coordinates;
      west = Math.min(west, Math.max(-180, lng));
      east = Math.max(east, Math.min(180, lng));
      south = Math.min(south, lat);
      north = Math.max(north, lat);
      bounds[0] = Math.min(bounds[0], lng);
      bounds[1] = Math.min(bounds[1], lat);
      bounds[2] = Math.max(bounds[2], lng);
      bounds[3] = Math.max(bounds[3], lat);
    } else coordinates.forEach(point => extend(point, bounds));
  };
  for (const feature of features) {
    const id = feature.properties.iso_3166_1;
    if (!assigned.has(id)) continue;
    const bounds = countryBounds.get(id) || [Infinity, Infinity, -Infinity, -Infinity];
    extend(feature.geometry.coordinates, bounds);
    countryBounds.set(id, bounds);
    matched.set(id, regions.get(feature.properties.iso_3166_1_alpha_3));
  }
  // Missing or dateline-spanning geometry warrants a global overview, never
  // the shortest longitudinal arc (which can center this experience on the Pacific).
  const globalOverview = matched.size !== assigned.size || !matched.size || east - west > 300;
  const initialBounds = countryBounds.get(initialCountry);
  return {
    initialCenter: initialBounds ? matched.get(initialCountry)?.center ||
      [(initialBounds[0] + initialBounds[2]) / 2, (initialBounds[1] + initialBounds[3]) / 2] : null,
    bounds: globalOverview ? [[-180, -60], [180, 85]] : [[west, south], [east, north]],
    lived: [...matched].filter(([, region]) => region?.status === "lived").map(([id]) => id),
    worked: [...matched].filter(([, region]) => region?.status === "worked").map(([id]) => id),
    labels: {
      type: "FeatureCollection",
      features: [...matched].map(([id, region]) => ({
        type: "Feature",
        properties: {countryId: id, name: assigned.get(id).label, iso3: region?.iso3 || "", status: region?.status || ""},
        geometry: {type: "Point", coordinates: region?.center || [(countryBounds.get(id)[0] + countryBounds.get(id)[2]) / 2, (countryBounds.get(id)[1] + countryBounds.get(id)[3]) / 2]},
      })),
    },
  };
}
