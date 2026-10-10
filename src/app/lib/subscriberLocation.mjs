export function normalizeSubscriberLocation(geo) {
  if (!geo) return null;
  const coordinate = (value, max) => {
    if (value == null || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && Math.abs(number) <= max ? number : null;
  };
  const location = {
    city: String(geo.city || "").slice(0, 160),
    state: String(geo.state || "").slice(0, 160),
    country: String(geo.country || "").slice(0, 160),
    latitude: coordinate(geo.latitude, 90),
    longitude: coordinate(geo.longitude, 180),
    source: "ipgeolocation",
  };
  if (location.latitude == null || location.longitude == null) {
    location.latitude = null;
    location.longitude = null;
  }
  return location.city || location.state || location.country || location.latitude != null ? location : null;
}

export function subscriberLocationLabel(location) {
  return [location?.city, location?.state, location?.country].filter(Boolean).join(", ") || "Unknown";
}
