function setHeader(headers, name, value) {
  const text = String(value || "").trim();

  if (text) {
    headers.set(name, text);
  }
}

function setCountryHeaders(headers, country = {}) {
  setHeader(headers, "x-site-geo-country-code", country.code);
  setHeader(headers, "x-site-geo-country-name", country.name);
}

function setSubdivisionHeaders(headers, subdivision = {}) {
  setHeader(headers, "x-site-geo-subdivision-code", subdivision.code);
  setHeader(headers, "x-site-geo-subdivision-name", subdivision.name);
}

export default function geoHeaders(request, context = {}) {
  const geo = context.geo || {};

  setHeader(request.headers, "x-site-client-ip", context.ip);
  setCountryHeaders(request.headers, geo.country);
  setSubdivisionHeaders(request.headers, geo.subdivision);
  setHeader(request.headers, "x-site-geo-city", geo.city);
  setHeader(request.headers, "x-site-geo-postal-code", geo.postalCode || geo.postal_code);
  setHeader(request.headers, "x-site-geo-latitude", geo.latitude);
  setHeader(request.headers, "x-site-geo-longitude", geo.longitude);
  setHeader(request.headers, "x-site-geo-timezone", geo.timezone);
}

export const config = {
  path: ["/api/contact", "/api/language"],
};
