import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  ROBOTS_CONTENT,
  SITE_AUTHOR,
  SITE_ICON,
  SITE_LANGUAGE,
  SITE_LOCALE,
  SITE_NAME,
  SITE_SOCIAL_IMAGE,
  createStructuredData,
  getCanonicalUrl,
  getSeoPage,
} from "../config/seo.js";

const upsertMeta = (attribute, key, content) => {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }

  element.setAttribute("content", content);
};

const upsertCanonical = (href) => {
  let element = document.head.querySelector('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.append(element);
  }

  element.setAttribute("href", href);
};

const Seo = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const page = getSeoPage(pathname);
    const canonicalUrl = getCanonicalUrl(page);

    document.documentElement.lang = SITE_LANGUAGE;
    document.title = page.title;

    upsertMeta("name", "description", page.description);
    upsertMeta("name", "author", SITE_AUTHOR);
    upsertMeta(
      "name",
      "robots",
      page.noindex ? "noindex, follow" : ROBOTS_CONTENT,
    );
    upsertMeta("name", "theme-color", "#0d0f13");
    upsertMeta("name", "color-scheme", "dark");

    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:locale", SITE_LOCALE);
    upsertMeta("property", "og:title", page.title);
    upsertMeta("property", "og:description", page.description);
    upsertMeta("property", "og:url", canonicalUrl);
    upsertMeta("property", "og:image", SITE_SOCIAL_IMAGE);
    upsertMeta(
      "property",
      "og:image:alt",
      "Slipstream Formula 1 analytics dashboard",
    );

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", page.title);
    upsertMeta("name", "twitter:description", page.description);
    upsertMeta("name", "twitter:image", SITE_SOCIAL_IMAGE);
    upsertMeta(
      "name",
      "twitter:image:alt",
      "Slipstream Formula 1 analytics dashboard",
    );

    upsertCanonical(canonicalUrl);

    let structuredData = document.getElementById("slipstream-structured-data");
    if (!structuredData) {
      structuredData = document.createElement("script");
      structuredData.id = "slipstream-structured-data";
      structuredData.type = "application/ld+json";
      document.head.append(structuredData);
    }
    structuredData.textContent = JSON.stringify(createStructuredData(page));

    let icon = document.head.querySelector('link[rel="icon"]');
    if (icon) {
      icon.setAttribute("href", SITE_ICON);
      icon.setAttribute("type", "image/png");
    }
  }, [pathname]);

  return null;
};

export default Seo;
