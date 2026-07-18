export const SITE_NAME = "Slipstream";
export const SITE_URL = "https://f1datadesktop.com";
export const SITE_LOCALE = "en_US";
export const SITE_LANGUAGE = "en-US";
export const SITE_AUTHOR = "Cameron Griffin";
export const SITE_DESCRIPTION =
  "Explore 2025 and 2026 Formula 1 standings, race results, driver comparisons, sector pace, pit-stop performance, and race-by-race strategy analysis.";
export const SITE_SOCIAL_IMAGE = `${SITE_URL}/slipstream-social.png`;
export const SITE_ICON = `${SITE_URL}/slipstream-icon.png`;
export const ROBOTS_CONTENT =
  "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";

const seasons = [2026, 2025];

const sectionDefinitions = [
  {
    section: "drivers",
    title: (year) => `${year} F1 Driver Championship Standings | Slipstream`,
    description: (year) =>
      `Follow the ${year} Formula 1 driver championship race by race with cumulative points, standings movement, team colors, and driver comparisons.`,
    datasetName: (year) => `${year} Formula 1 driver championship standings`,
    variables: [
      "Driver championship points",
      "Race-by-race standings movement",
      "Driver position",
    ],
  },
  {
    section: "constructors",
    title: (year) => `${year} F1 Constructor Championship | Slipstream`,
    description: (year) =>
      `Track the ${year} Formula 1 constructor championship round by round, including team rankings, position changes, and season-long performance.`,
    datasetName: (year) => `${year} Formula 1 constructor championship standings`,
    variables: [
      "Constructor championship position",
      "Team ranking by round",
      "Season standings movement",
    ],
  },
  {
    section: "driver-results",
    title: (year) => `${year} F1 Race Results & Finishing Trends | Slipstream`,
    description: (year) =>
      `Compare ${year} Formula 1 race results and finishing-position trends across every completed round, driver, and team.`,
    datasetName: (year) => `${year} Formula 1 race results and finishing trends`,
    variables: [
      "Race finishing position",
      "Driver result by round",
      "Position movement",
    ],
  },
  {
    section: "driver-stats",
    title: (year) => `${year} F1 Driver Statistics & Performance | Slipstream`,
    description: (year) =>
      `Explore ${year} Formula 1 driver statistics, qualifying and race performance, consistency, points efficiency, and team comparisons.`,
    datasetName: (year) => `${year} Formula 1 driver performance statistics`,
    variables: [
      "Driver points",
      "Average qualifying position",
      "Average race finish",
      "Performance consistency",
    ],
  },
  {
    section: "head-to-head",
    title: (year) => `${year} F1 Driver Head-to-Head Comparison | Slipstream`,
    description: (year) =>
      `Compare any two ${year} Formula 1 drivers across qualifying, races, sprints, championship points, and average finishing performance.`,
    datasetName: (year) => `${year} Formula 1 driver head-to-head comparisons`,
    variables: [
      "Qualifying head-to-head result",
      "Race head-to-head result",
      "Sprint head-to-head result",
      "Championship points gap",
    ],
  },
  {
    section: "sector-analysis",
    title: (year) => `${year} F1 Sector Time Analysis | Slipstream`,
    description: (year) =>
      `Analyze ${year} Formula 1 sector times, driver pace, consistency, and session-relative performance from completed race weekends.`,
    datasetName: (year) => `${year} Formula 1 sector timing analysis`,
    variables: [
      "Sector 1 time",
      "Sector 2 time",
      "Sector 3 time",
      "Driver pace versus session average",
    ],
  },
  {
    section: "pit-stop-analysis",
    title: (year) => `${year} F1 Pit Stop & Pit-Lane Analysis | Slipstream`,
    description: (year) =>
      `Compare ${year} Formula 1 pit-stop service times, total pit-lane transit, team and driver trends, and operational time gained or lost.`,
    datasetName: (year) => `${year} Formula 1 pit-stop and pit-lane timing analysis`,
    variables: [
      "Stationary pit-stop service time",
      "Total pit-lane time",
      "Pit-lane transit time",
      "Pit-stop timing delta",
    ],
  },
];

const homePage = {
  path: "/",
  title: "Formula 1 Analytics, Standings & Strategy | Slipstream",
  description: SITE_DESCRIPTION,
  label: "Slipstream F1 Analytics",
  pageType: "WebPage",
};

const seasonPages = seasons.flatMap((year) =>
  sectionDefinitions.map((definition) => ({
    path: `/${year}/${definition.section}`,
    title: definition.title(year),
    description: definition.description(year),
    label: definition.title(year).replace(" | Slipstream", ""),
    pageType: "WebPage",
    season: year,
    datasetName: definition.datasetName(year),
    variables: definition.variables,
  })),
);

const raceStoryPage = {
  path: "/2026/race-story",
  title: "2026 F1 Race Story & Overtake Analysis | Slipstream",
  description:
    "Read each completed 2026 Formula 1 race through overtakes, traffic, pit cycles, attrition, position changes, and race-shaping events.",
  label: "2026 F1 Race Story",
  pageType: "WebPage",
  season: 2026,
  datasetName: "2026 Formula 1 race stories and overtaking analysis",
  variables: [
    "On-track passes",
    "Retained overtakes",
    "Traffic laps",
    "Pit cycles",
    "Race attrition",
  ],
};

const aboutPage = {
  path: "/about",
  title: "About Slipstream F1 Analytics",
  description:
    "Learn how Slipstream turns Formula 1 standings, race results, timing records, pit-stop data, and strategy events into focused visual analysis.",
  label: "About Slipstream",
  pageType: "AboutPage",
};

export const NOT_FOUND_PAGE = {
  path: "/404",
  title: "Page Not Found | Slipstream",
  description:
    "The requested Slipstream Formula 1 analytics page could not be found.",
  label: "Page Not Found",
  pageType: "WebPage",
  noindex: true,
};

export const SEO_PAGES = [homePage, ...seasonPages, raceStoryPage, aboutPage];

export const normalizeSeoPath = (pathname = "/") => {
  const withoutQuery = String(pathname).split(/[?#]/, 1)[0] || "/";
  if (withoutQuery === "/") return "/";
  return `/${withoutQuery.split("/").filter(Boolean).join("/")}`;
};

export const getSeoPage = (pathname) => {
  const normalizedPath = normalizeSeoPath(pathname);
  return (
    SEO_PAGES.find(({ path }) => path === normalizedPath) ?? {
      ...NOT_FOUND_PAGE,
      path: normalizedPath,
    }
  );
};

export const getCanonicalUrl = (pageOrPath) => {
  const path =
    typeof pageOrPath === "string"
      ? normalizeSeoPath(pageOrPath)
      : normalizeSeoPath(pageOrPath?.path);
  return path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
};

export const createStructuredData = (page) => {
  const canonicalUrl = getCanonicalUrl(page);
  const organizationId = `${SITE_URL}/#organization`;
  const websiteId = `${SITE_URL}/#website`;
  const webpageId = `${canonicalUrl}#webpage`;

  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: SITE_NAME,
    alternateName: "Slipstream F1 Analytics",
    url: `${SITE_URL}/`,
    logo: {
      "@type": "ImageObject",
      url: SITE_ICON,
      width: 512,
      height: 512,
    },
    founder: {
      "@type": "Person",
      name: SITE_AUTHOR,
    },
  };

  const website = {
    "@type": "WebSite",
    "@id": websiteId,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    alternateName: "Slipstream F1 Analytics",
    description: SITE_DESCRIPTION,
    inLanguage: SITE_LANGUAGE,
    publisher: {
      "@id": organizationId,
    },
  };

  const webpage = {
    "@type": page.pageType ?? "WebPage",
    "@id": webpageId,
    url: canonicalUrl,
    name: page.title,
    description: page.description,
    inLanguage: SITE_LANGUAGE,
    isPartOf: {
      "@id": websiteId,
    },
    about: {
      "@id": organizationId,
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: SITE_SOCIAL_IMAGE,
      width: 1200,
      height: 630,
    },
  };

  const graph = [organization, website, webpage];

  if (page.path === "/") {
    graph.push({
      "@type": "WebApplication",
      "@id": `${SITE_URL}/#application`,
      name: "Slipstream F1 Analytics",
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "SportsApplication",
      operatingSystem: "Any",
      browserRequirements: "Requires a modern web browser with JavaScript enabled.",
      isAccessibleForFree: true,
      publisher: {
        "@id": organizationId,
      },
    });
  }

  if (page.season && page.datasetName) {
    const datasetId = `${canonicalUrl}#dataset`;
    webpage.mainEntity = {
      "@id": datasetId,
    };
    graph.push({
      "@type": "Dataset",
      "@id": datasetId,
      name: page.datasetName,
      description: page.description,
      url: canonicalUrl,
      creator: {
        "@type": "Person",
        name: SITE_AUTHOR,
      },
      publisher: {
        "@id": organizationId,
      },
      includedInDataCatalog: {
        "@type": "DataCatalog",
        name: "Slipstream Formula 1 Analytics",
        url: `${SITE_URL}/`,
      },
      temporalCoverage: String(page.season),
      isAccessibleForFree: true,
      measurementTechnique:
        "Aggregated race classifications, lap timing, sector timing, and pit-stop records.",
      variableMeasured: page.variables,
      keywords:
        "Formula 1, F1 analytics, championship standings, race results, driver performance",
    });
  }

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
};
