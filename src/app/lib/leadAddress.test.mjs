import assert from "node:assert/strict";
import {test} from "node:test";
import {addressFromMapbox, formatAddress, normalizeAddress, geocodeAddress} from "./leadAddress.mjs";
import {normalizeContact} from "./leadOutreach.mjs";

test("addresses are optional and partial addresses remain valid", () => {
  assert.equal(formatAddress(normalizeAddress()), "");
  assert.equal(normalizeContact({firstName: "Ada"}).address, undefined);
  const contact = normalizeContact({firstName: "Ada", address: {city: " Berlin "}});
  assert.equal(contact.address.city, "Berlin");
  assert.equal(contact.location, "Berlin");
});

test("structured addresses retain postal codes, international text, and unit details", () => {
  const contact = normalizeContact({firstName: "Ada", address: {street: " Müllerstraße ", houseNumber: "12a", addressLine2: "Unit 4", postalCode: "01234", city: "Dresden", country: "Germany", countryCode: "de"}});
  assert.equal(contact.address.postalCode, "01234");
  assert.equal(contact.address.countryCode, "DE");
  assert.equal(contact.location, "Müllerstraße 12a, Unit 4, 01234 Dresden, Germany");
});

test("Mapbox search results populate individual fields and coordinates", () => {
  const address = addressFromMapbox({properties: {coordinates: {latitude: 52.5, longitude: 13.4}, context: {address: {street_name: "Example Street", address_number: "12"}, postcode: {name: "10115"}, place: {name: "Berlin"}, region: {name: "Berlin"}, country: {name: "Germany", country_code: "DE"}}}});
  assert.equal(address.street, "Example Street");
  assert.equal(address.houseNumber, "12");
  assert.equal(address.city, "Berlin");
  assert.equal(address.latitude, 52.5);
  assert.equal(address.longitude, 13.4);
});

test("clearing an address also clears its label and coordinates", () => {
  const contact = normalizeContact({firstName: "Ada", location: "Old city", address: {latitude: 52.5, longitude: 13.4}});
  assert.equal(contact.location, "");
  assert.equal(contact.address.latitude, null);
  assert.equal(contact.address.longitude, null);
});

test("legacy locations remain readable without guessing street or city components", () => {
  const contact = normalizeContact({firstName: "Ada", location: "Old unstructured address"});
  assert.equal(contact.location, "Old unstructured address");
  assert.equal(contact.address, undefined);
});

test("invalid coordinates and address values are rejected; zero is a valid coordinate", () => {
  assert.throws(() => normalizeContact({firstName: "Ada", address: "Berlin"}), /valid address/);
  assert.throws(() => normalizeContact({firstName: "Ada", address: {city: "Berlin", latitude: 100, longitude: 13}}), /coordinates/);
  assert.equal(normalizeAddress({city: "Example", latitude: 0, longitude: 0}).longitude, 0);
  assert.equal(normalizeAddress({city: "Example", latitude: "", longitude: ""}).longitude, null);
});

test("city and street results work when their own context entry is absent", () => {
  assert.equal(addressFromMapbox({properties: {feature_type: "place", name: "Berlin", context: {country: {name: "Germany"}}}}).city, "Berlin");
  assert.equal(addressFromMapbox({properties: {feature_type: "street", name: "Example Street"}}).street, "Example Street");
});

test("manual address lookup adds coordinates without replacing entered fields", async () => {
  const address = {street: "My Street", houseNumber: "12", addressLine2: "Suite 4", city: "Berlin"};
  const result = await geocodeAddress(address, {token: "test", fetcher: async (url) => {
    assert.equal(new URL(url).searchParams.get("permanent"), "true");
    assert.equal(new URL(url).searchParams.get("autocomplete"), "false");
    return {ok: true, json: async () => ({features: [{geometry: {coordinates: [13.4, 52.5]}}]})};
  }});
  assert.equal(result.street, "My Street");
  assert.equal(result.addressLine2, "Suite 4");
  assert.equal(result.latitude, 52.5);
  assert.equal(result.longitude, 13.4);
});

test("selected coordinates and empty addresses do not need a second lookup", async () => {
  const fetcher = () => {throw new Error("Unexpected lookup");};
  const selected = {city: "Berlin", latitude: 52.5, longitude: 13.4};
  assert.equal((await geocodeAddress(selected, {fetcher})).latitude, 52.5);
  assert.equal((await geocodeAddress({}, {fetcher})).latitude, null);
});

test("missing coordinates are geocoded for selections and failures stay explicit", async () => {
  const address = addressFromMapbox({properties: {feature_type: "place", name: "Berlin"}});
  const response = (features) => async () => ({ok: true, json: async () => ({features})});
  const resolved = await geocodeAddress(address, {token: "test", fetcher: response([{properties: {coordinates: {latitude: 52.5, longitude: 13.4}}}])});
  assert.equal(resolved.latitude, 52.5);
  await assert.rejects(geocodeAddress(address, {token: "test", fetcher: response([])}), /No map location/);
  await assert.rejects(geocodeAddress(address, {token: "test", fetcher: async () => ({ok: false})}), /Unable to locate/);
});
