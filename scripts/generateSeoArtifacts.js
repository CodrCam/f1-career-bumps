import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ROBOTS_CONTENT,
  NOT_FOUND_PAGE,
  SEO_PAGES,
  SITE_AUTHOR,
  SITE_DESCRIPTION,
  SITE_ICON,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_SOCIAL_IMAGE,
  SITE_URL,
  createStructuredData,
  getCanonicalUrl,
} from "../src/config/seo.js";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const distDirectory = path.join(projectRoot, "dist");
const indexPath = path.join(distDirectory, "index.html");

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const escapeXml = (value) =>
  escapeHtml(value).replaceAll("'", "&apos;");

const replaceTag = (html, pattern, replacement, label) => {
  if (!pattern.test(html)) {
    throw new Error(`Could not find ${label} in the built HTML.`);
  }
  return html.replace(pattern, replacement);
};

const replaceMeta = (html, attribute, key, content) =>
  replaceTag(
    html,
    new RegExp(
      `<meta(?=[^>]*\\b${attribute}=["']${key.replaceAll(
        ":",
        "\\:",
      )}["'])[^>]*>`,
      "i",
    ),
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`,
    `${attribute}="${key}" meta tag`,
  );

const serializeStructuredData = (page) =>
  JSON.stringify(createStructuredData(page)).replaceAll("<", "\\u003c");

const createFallbackMarkup = (page) => {
  const season = page.season ?? 2026;
  const links = [
    { label: "Home", path: "/" },
    { label: `${season} Driver Profiles`, path: `/${season}/drivers` },
    { label: `${season} Championship`, path: `/${season}/standings/drivers` },
    { label: `${season} Constructors`, path: `/${season}/standings/constructors` },
    { label: `${season} Race Archive`, path: `/${season}/races` },
    { label: `${season} Race Results`, path: `/${season}/results` },
    {
      label: `${season} Pit Lane Analysis`,
      path: `/${season}/pit-lane`,
    },
    { label: "Methodology", path: "/methodology" },
  ];

  const navigation = links
    .map(
      ({ label, path: linkPath }) =>
        `<a href="${escapeHtml(linkPath)}">${escapeHtml(label)}</a>`,
    )
    .join("");

  return `<main class="seo-fallback"><p class="seo-fallback__eyebrow">Slipstream F1 Analytics</p><h1>${escapeHtml(
    page.title.replace(" | Slipstream", ""),
  )}</h1><p>${escapeHtml(
    page.description,
  )}</p><nav aria-label="Explore Slipstream">${navigation}</nav><p class="seo-fallback__note">Interactive charts load when JavaScript is available.</p></main>`;
};

const renderPageHtml = (
  template,
  page,
  { robots = ROBOTS_CONTENT } = {},
) => {
  const canonicalUrl = getCanonicalUrl(page);
  let html = template;

  html = replaceTag(
    html,
    /<html\b[^>]*\blang=["'][^"']*["'][^>]*>/i,
    `<html lang="${SITE_LANGUAGE}">`,
    "html language attribute",
  );
  html = replaceTag(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(page.title)}</title>`,
    "title",
  );
  html = replaceMeta(html, "name", "description", page.description);
  html = replaceMeta(html, "name", "author", SITE_AUTHOR);
  html = replaceMeta(html, "name", "robots", robots);
  html = replaceMeta(html, "property", "og:title", page.title);
  html = replaceMeta(html, "property", "og:description", page.description);
  html = replaceMeta(html, "property", "og:url", canonicalUrl);
  html = replaceMeta(html, "name", "twitter:title", page.title);
  html = replaceMeta(html, "name", "twitter:description", page.description);
  html = replaceTag(
    html,
    /<link(?=[^>]*\brel=["']canonical["'])[^>]*>/i,
    `<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`,
    "canonical link",
  );
  html = replaceTag(
    html,
    /<script(?=[^>]*\bid=["']slipstream-structured-data["'])[^>]*>[\s\S]*?<\/script>/i,
    `<script type="application/ld+json" id="slipstream-structured-data">${serializeStructuredData(
      page,
    )}</script>`,
    "structured data",
  );
  html = replaceTag(
    html,
    /<div\s+id=["']root["']>\s*<\/div>/i,
    `<div id="root">${createFallbackMarkup(page)}</div>`,
    "application root",
  );

  return html;
};

const createSitemap = () => {
  const urls = SEO_PAGES.map(
    (page) => `  <url><loc>${escapeXml(getCanonicalUrl(page))}</loc></url>`,
  ).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
};

const createLlmsTxt = () => {
  const routeGroups = [
    {
      heading: "Primary pages",
      pages: SEO_PAGES.filter(({ season }) => !season),
    },
    {
      heading: "2026 analytics",
      pages: SEO_PAGES.filter(({ season }) => season === 2026),
    },
    {
      heading: "2025 analytics",
      pages: SEO_PAGES.filter(({ season }) => season === 2025),
    },
  ];

  const groups = routeGroups
    .map(
      ({ heading, pages }) =>
        `## ${heading}\n\n${pages
          .map(
            (page) =>
              `- [${page.label}](${getCanonicalUrl(page)}): ${page.description}`,
          )
          .join("\n")}`,
    )
    .join("\n\n");

  return `# ${SITE_NAME}\n\n> ${SITE_DESCRIPTION}\n\nSlipstream is a free, independent Formula 1 analytics website created and maintained by ${SITE_AUTHOR}. The canonical site is ${SITE_URL}/. It is not affiliated with Formula 1, the FIA, or any team.\n\n${groups}\n\n## Data interpretation\n\n- Season pages cover completed 2025 and 2026 Formula 1 sessions.\n- The site combines race classifications, timing records, sector data, and pit-stop records into original visual analysis.\n- Charts are descriptive analytics and should not be interpreted as official championship documentation.\n- Use each linked page's visible season, race, driver, and data-source labels when citing a result.\n`;
};

const createRobotsTxt = () =>
  `User-agent: OAI-SearchBot\nAllow: /\n\nUser-agent: ChatGPT-User\nAllow: /\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: Google-Extended\nAllow: /\n\nUser-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

const build = async () => {
  const template = await readFile(indexPath, "utf8");

  for (const page of SEO_PAGES) {
    const html = renderPageHtml(template, page);
    const outputPath =
      page.path === "/"
        ? indexPath
        : path.join(
            distDirectory,
            ...page.path.split("/").filter(Boolean),
            "index.html",
          );

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, html);
  }

  await writeFile(
    path.join(distDirectory, "404.html"),
    renderPageHtml(template, NOT_FOUND_PAGE, {
      robots: "noindex, follow",
    }),
  );

  await writeFile(path.join(distDirectory, "sitemap.xml"), createSitemap());
  await writeFile(path.join(distDirectory, "robots.txt"), createRobotsTxt());
  await writeFile(path.join(distDirectory, "llms.txt"), createLlmsTxt());

  console.log(
    `Generated ${SEO_PAGES.length} SEO route shells, sitemap.xml, robots.txt, llms.txt, and 404.html.`,
  );
};

await build();
