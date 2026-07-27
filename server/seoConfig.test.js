import assert from "node:assert/strict";
import test from "node:test";
import {
  SEO_PAGES,
  SITE_URL,
  createStructuredData,
  getCanonicalUrl,
  getSeoPage,
} from "../src/config/seo.js";

test("provides unique canonical metadata for every indexable route", () => {
  const paths = SEO_PAGES.map(({ path }) => path);
  const titles = SEO_PAGES.map(({ title }) => title);
  const descriptions = SEO_PAGES.map(({ description }) => description);

  assert.equal(new Set(paths).size, paths.length);
  assert.equal(new Set(titles).size, titles.length);
  assert.equal(new Set(descriptions).size, descriptions.length);

  SEO_PAGES.forEach((page) => {
    assert.match(getCanonicalUrl(page), new RegExp(`^${SITE_URL}`));
    assert.ok(page.title.length >= 25 && page.title.length <= 70);
    assert.ok(page.description.length >= 50 && page.description.length <= 180);
  });
});

test("normalizes route lookups and returns machine-readable structured data", () => {
  const page = getSeoPage("/2026/standings/drivers/?source=test");
  const structuredData = createStructuredData(page);
  const types = structuredData["@graph"].map((entry) => entry["@type"]);

  assert.equal(page.path, "/2026/standings/drivers");
  assert.ok(types.includes("WebSite"));
  assert.ok(types.includes("WebPage"));
  assert.ok(types.includes("Dataset"));
});

test("creates canonical metadata for race dossier routes", () => {
  const page = getSeoPage("/2025/races/12");

  assert.equal(page.path, "/2025/races/12");
  assert.equal(page.season, 2025);
  assert.match(page.title, /Round 12 Race Dossier/);
});

test("publishes Ask Slipstream as a canonical web application", () => {
  const page = getSeoPage("/ask?season=2026");
  const structuredData = createStructuredData(page);
  const webpage = structuredData["@graph"].find(
    (entry) => entry["@id"] === `${SITE_URL}/ask#webpage`,
  );

  assert.equal(page.path, "/ask");
  assert.equal(page.pageType, "WebApplication");
  assert.equal(webpage["@type"], "WebApplication");
});

test("marks unknown routes as non-indexable instead of treating them as home", () => {
  const page = getSeoPage("/not-a-real-route");

  assert.equal(page.path, "/not-a-real-route");
  assert.equal(page.noindex, true);
  assert.equal(page.title, "Page Not Found | Slipstream");
});
