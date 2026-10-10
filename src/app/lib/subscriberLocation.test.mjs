import assert from "node:assert/strict";
import {test} from "node:test";
import {normalizeSubscriberLocation, subscriberLocationLabel} from "./subscriberLocation.mjs";

test("location normalization retains zero coordinates and excludes provider personal data", () => {
  const location = normalizeSubscriberLocation({city: "Example", latitude: "0", longitude: "0", ip: "203.0.113.1", postalCode: "12345"});
  assert.equal(location.latitude, 0);
  assert.equal(location.longitude, 0);
  assert.equal(location.ip, undefined);
  assert.equal(location.postalCode, undefined);
  assert.equal(subscriberLocationLabel(location), "Example");
});

test("missing or invalid coordinates cannot become map markers at zero", () => {
  for (const latitude of [null, "", " ", "invalid", 91]) {
    const location = normalizeSubscriberLocation({country: "Germany", latitude, longitude: 13});
    assert.equal(location.latitude, null);
    assert.equal(location.longitude, null);
  }
  assert.equal(normalizeSubscriberLocation(null), null);
  assert.equal(normalizeSubscriberLocation({}), null);
  assert.equal(subscriberLocationLabel(null), "Unknown");
});
