import test from "node:test";
import assert from "node:assert/strict";
import {publicAddress} from "./publicAddress.mjs";

const address = {
  label: "Example Street 12, Munich",
  placeName: "Example Street 12, Munich, Germany",
  mapboxId: "address.123",
  longitude: 11.58,
  latitude: 48.14,
  publicLabel: "Munich",
};

test("existing profiles retain the full address", () => {
  assert.deepEqual(publicAddress(address), address);
  assert.equal(publicAddress(null), null);
});

test("hidden street addresses expose only the public label and map coordinates", () => {
  assert.deepEqual(publicAddress({...address, hideStreetAddress: true}), {
    label: "Munich",
    longitude: 11.58,
    latitude: 48.14,
  });
});

test("a missing public label never falls back to the private address", () => {
  assert.equal(publicAddress({...address, hideStreetAddress: true, publicLabel: ""}).label, "");
});
