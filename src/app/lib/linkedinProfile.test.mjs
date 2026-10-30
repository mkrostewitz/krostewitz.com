import test from "node:test";
import assert from "node:assert/strict";
import {normalizeLinkedinProfileUrl, linkedinProfileState} from "./linkedinProfile.mjs";
import {normalizeContact} from "./leadOutreach.mjs";

test("pasted profile links normalize schemes, regional hosts and tracking", () => {
  for (const value of [" linkedin.com/in/-timm-schroeder/ ", "https://www.linkedin.com/in/-timm-schroeder/?trk=search#about", "http://de.linkedin.com/in/-timm-schroeder"]) {
    assert.equal(normalizeLinkedinProfileUrl(value), "https://www.linkedin.com/in/-timm-schroeder");
    assert.equal(normalizeContact({name: "Timm", linkedinUrl: value}).linkedinUrl, "https://www.linkedin.com/in/-timm-schroeder");
  }
  assert.equal(normalizeLinkedinProfileUrl("https://linkedin.com/in/schröder"), "https://www.linkedin.com/in/schr%C3%B6der");
  assert.equal(normalizeLinkedinProfileUrl(""), "");
});

test("invalid or misleading profile URLs are rejected in both form and persistence", () => {
  for (const value of ["https://linkedin.com.evil.test/in/person", "https://evil.test/in/person", "https://linkedin.com/company/example", "https://linkedin.com/in/", "https://user:password@linkedin.com/in/name", "javascript:alert(1)", "https://linkedin.com:123/in/name", "https://linkedin.com/in/a%2Fb", "https://linkedin.com/in/a%20b", "https://linkedin.com/in/a%ZZ", "https://linkedin.com/in/a\nb", "https://linkedin.com/in/name/details", {}]) {
    assert.throws(() => normalizeLinkedinProfileUrl(value));
    assert.throws(() => normalizeContact({name: "Timm", linkedinUrl: value}));
    assert.equal(linkedinProfileState(value).url, "");
    assert.ok(linkedinProfileState(value).error);
  }
});
