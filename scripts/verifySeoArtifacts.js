import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SEO_PAGES,
  SITE_URL,
  getCanonicalUrl,
} from "../src/config/seo.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDirectory = path.join(projectRoot, "dist");

const readDistFile = (...segments) =>
  readFile(path.join(distDirectory, ...segments), "utf8");

const extractStructuredData = (html) => {
  const match = html.match(
    /<script(?=[^>]*\bid=["']slipstream-structured-data["'])[^>]*>([\s\S]*?)<\/script>/i,
  );
  assert.ok(match, "Missing structured-data script.");
  return JSON.parse(match[1]);
};

for (const page of SEO_PAGES) {
  const segments =
    page.path === "/"
      ? ["index.html"]
      : [...page.path.split("/").filter(Boolean), "index.html"];
  const html = await readDistFile(...segments);
  const canonicalUrl = getCanonicalUrl(page);
  const structuredData = extractStructuredData(html);
  const types = structuredData["@graph"].map((entry) => entry["@type"]);

  assert.ok(html.includes(`<title>${page.title.replaceAll("&", "&amp;")}</title>`));
  assert.ok(
    html.includes(`<link rel="canonical" href="${canonicalUrl}" />`),
    `Missing canonical URL for ${page.path}.`,
  );
  assert.ok(
    html.includes('class="seo-fallback"'),
    `Missing crawler fallback for ${page.path}.`,
  );
  assert.ok(types.includes("WebSite"));
  assert.ok(types.includes(page.pageType));
  if (page.season) assert.ok(types.includes("Dataset"));
}

const sitemap = await readDistFile("sitemap.xml");
for (const page of SEO_PAGES) {
  assert.ok(
    sitemap.includes(`<loc>${getCanonicalUrl(page)}</loc>`),
    `Missing sitemap URL for ${page.path}.`,
  );
}

const robots = await readDistFile("robots.txt");
assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));
assert.ok(robots.includes("User-agent: OAI-SearchBot"));
assert.ok(robots.includes("User-agent: Google-Extended"));

const llms = await readDistFile("llms.txt");
for (const page of SEO_PAGES) {
  assert.ok(
    llms.includes(getCanonicalUrl(page)),
    `Missing llms.txt URL for ${page.path}.`,
  );
}

const notFound = await readDistFile("404.html");
assert.ok(notFound.includes('content="noindex, follow"'));

console.log(`Verified ${SEO_PAGES.length} generated SEO route shells.`);
