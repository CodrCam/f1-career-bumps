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
    path: "standings/drivers",
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
    path: "standings/constructors",
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
    path: "results",
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
    path: "races",
    title: (year) => `${year} F1 Race Archive & Analysis | Slipstream`,
    description: (year) =>
      `Open every completed ${year} Formula 1 race dossier, with the official classification published first and detailed overtakes, pit cycles, and attrition added when timing is ready.`,
    datasetName: (year) => `${year} Formula 1 race archive`,
    variables: [
      "Official race classification",
      "Race-story publication status",
      "Retained overtakes",
      "Pit cycles",
      "Race attrition",
    ],
  },
  {
    path: "drivers",
    title: (year) => `${year} F1 Driver Directory & Form Guide | Slipstream`,
    description: (year) =>
      `Explore every ${year} Formula 1 driver through championship position, recent form, reliability, points efficiency, and linked race evidence.`,
    datasetName: (year) => `${year} Formula 1 driver directory`,
    variables: [
      "Driver championship points",
      "Recent finishing form",
      "Average race finish",
      "Reliability rate",
    ],
  },
  {
    path: "compare",
    title: (year) => `${year} F1 Driver Comparison Workspace | Slipstream`,
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
    path: "pace",
    title: (year) => `${year} F1 Pace & Sector Analysis Lab | Slipstream`,
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
    path: "pit-lane",
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
    path: `/${year}/${definition.path}`,
    title: definition.title(year),
    description: definition.description(year),
    label: definition.title(year).replace(" | Slipstream", ""),
    pageType: "WebPage",
    season: year,
    datasetName: definition.datasetName(year),
    variables: definition.variables,
  })),
);

const seasonDeskPages = seasons.map((year) => ({
  path: `/${year}`,
  title: `${year} F1 Season Desk, Results & Standings | Slipstream`,
  description:
    `Open the ${year} Formula 1 season desk for the latest classified race, championship leaders, publication status, and direct access to pace and strategy analysis.`,
  label: `${year} F1 Season Desk`,
  pageType: "WebPage",
  season: year,
  datasetName: `${year} Formula 1 season overview`,
  variables: [
    "Latest race classification",
    "Driver championship points",
    "Constructor championship points",
    "Race-story publication coverage",
  ],
}));

const methodologyPage = {
  path: "/methodology",
  title: "Slipstream F1 Data Sources & Methodology",
  description:
    "Review Slipstream data sources, publication states, analytical definitions, timing limitations, and the rules used to calculate each Formula 1 metric.",
  label: "Slipstream Methodology",
  pageType: "WebPage",
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

export const SEO_PAGES = [
  homePage,
  ...seasonDeskPages,
  ...seasonPages,
  methodologyPage,
];

export const normalizeSeoPath = (pathname = "/") => {
  const withoutQuery = String(pathname).split(/[?#]/, 1)[0] || "/";
  if (withoutQuery === "/") return "/";
  return `/${withoutQuery.split("/").filter(Boolean).join("/")}`;
};

export const getSeoPage = (pathname) => {
  const normalizedPath = normalizeSeoPath(pathname);
  const driverProfileMatch = normalizedPath.match(
    /^\/(2025|2026)\/drivers\/([^/]+)$/,
  );
  if (driverProfileMatch) {
    const season = Number(driverProfileMatch[1]);
    const driverName = decodeURIComponent(driverProfileMatch[2])
      .split("-")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
    return {
      path: normalizedPath,
      title: `${driverName} ${season} F1 Profile & Results | Slipstream`,
      description:
        `Review ${driverName}'s ${season} Formula 1 results, recent form, qualifying performance, reliability, points efficiency, and teammate context.`,
      label: `${driverName} ${season} F1 Driver Profile`,
      pageType: "ProfilePage",
      season,
      datasetName: `${driverName} ${season} Formula 1 performance`,
      variables: [
        "Race result by round",
        "Qualifying position",
        "Championship points",
        "Reliability rate",
      ],
    };
  }
  const raceDossierMatch = normalizedPath.match(/^\/(2025|2026)\/races\/(\d+)$/);
  if (raceDossierMatch) {
    const season = Number(raceDossierMatch[1]);
    const round = Number(raceDossierMatch[2]);
    return {
      path: normalizedPath,
      title: `${season} F1 Round ${round} Race Dossier | Slipstream`,
      description:
        `Review the official classification and available race-shaping analysis for round ${round} of the ${season} Formula 1 season.`,
      label: `${season} F1 Round ${round} Race Dossier`,
      pageType: "WebPage",
      season,
      datasetName: `${season} Formula 1 round ${round} race dossier`,
      variables: [
        "Official race classification",
        "Grid position change",
        "Retained overtakes",
        "Pit cycles",
        "Race attrition",
      ],
    };
  }
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
