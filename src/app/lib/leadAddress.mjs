export const ADDRESS_FIELDS = {
  street: "Street",
  houseNumber: "House / building number",
  addressLine2: "Apartment, suite, or address line 2",
  postalCode: "Postal code",
  city: "City / town",
  region: "State / region",
  country: "Country",
};
const text = (value, max = 200) => String(value ?? "").replace(/\u0000/g, "").trim().slice(0, max);

export function normalizeAddress(input) {
  if (input == null) input = {};
  if (typeof input !== "object" || Array.isArray(input)) throw new Error("Enter a valid address.");
  const address = Object.fromEntries(Object.keys(ADDRESS_FIELDS).map((key) => [key, text(input[key])]));
  address.countryCode = /^[a-z]{2}$/i.test(input.countryCode || "") ? input.countryCode.toUpperCase() : "";
  address.latitude = null;
  address.longitude = null;
  const supplied = [input.latitude, input.longitude].every((value) => value !== null && value !== undefined && value !== "");
  if (supplied) {
    const latitude = Number(input.latitude);
    const longitude = Number(input.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new Error("Invalid address coordinates.");
    address.latitude = latitude;
    address.longitude = longitude;
  }
  if (!formatAddress(address)) {
    address.latitude = null;
    address.longitude = null;
    address.countryCode = "";
  }
  return address;
}

export function formatAddress(address = {}) {
  return [
    [address.street, address.houseNumber].filter(Boolean).join(" "),
    address.addressLine2,
    [address.postalCode, address.city].filter(Boolean).join(" "),
    address.region,
    address.country,
  ].filter(Boolean).join(", ");
}

export function addressFromMapbox(feature) {
  const properties = feature?.properties || {};
  const context = properties.context || {};
  const coordinates = properties.coordinates || {};
  return normalizeAddress({
    street: context.address?.street_name || context.street?.name || (properties.feature_type === "street" ? properties.name : ""),
    houseNumber: context.address?.address_number || "",
    postalCode: context.postcode?.name || (properties.feature_type === "postcode" ? properties.name : ""),
    city: context.place?.name || context.locality?.name || (properties.feature_type === "place" ? properties.name : ""),
    region: context.region?.name || "",
    country: context.country?.name || "",
    countryCode: context.country?.country_code || "",
    latitude: coordinates.latitude ?? feature?.geometry?.coordinates?.[1],
    longitude: coordinates.longitude ?? feature?.geometry?.coordinates?.[0],
  });
}

export function hasAddressCoordinates(address) {
  return Boolean(address && typeof address.latitude === "number" && typeof address.longitude === "number" && Number.isFinite(address.latitude) && Number.isFinite(address.longitude) && Math.abs(address.latitude) <= 90 && Math.abs(address.longitude) <= 180);
}

// Preserve the entered address; geocoding only adds coordinates, never rewrites it.
export async function geocodeAddress(address, {token, signal, fetcher = fetch} = {}) {
  const normalized = normalizeAddress(address);
  const query = formatAddress(normalized);
  if (!query || hasAddressCoordinates(normalized)) return normalized;
  if (!token) throw new Error("Address lookup is unavailable. The address can still be saved.");
  const params = new URLSearchParams({q: query, access_token: token, permanent: "true", autocomplete: "false", limit: "1"});
  const response = await fetcher(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, {signal});
  if (!response.ok) throw new Error("Unable to locate the address. Check the address or retry.");
  const data = await response.json();
  const feature = data.features?.[0];
  const latitude = feature?.properties?.coordinates?.latitude ?? feature?.geometry?.coordinates?.[1];
  const longitude = feature?.properties?.coordinates?.longitude ?? feature?.geometry?.coordinates?.[0];
  if (!hasAddressCoordinates({latitude, longitude})) throw new Error("No map location found. Add a city or postal code and try again.");
  return {...normalized, latitude, longitude};
}
