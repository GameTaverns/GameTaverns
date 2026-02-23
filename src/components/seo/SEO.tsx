import { useEffect } from "react";

interface SEOProps {
  /** Page title — will be suffixed with " | GameTaverns" unless noSuffix is true */
  title: string;
  /** Meta description — keep under 160 chars */
  description?: string;
  /** Canonical URL — full absolute URL */
  canonical?: string;
  /** Open Graph image URL — full absolute URL */
  ogImage?: string;
  /** OG type — defaults to "website" */
  ogType?: "website" | "article" | "profile";
  /** Disable search engine indexing (e.g. private pages) */
  noIndex?: boolean;
  /** Skip " | GameTaverns" suffix */
  noSuffix?: boolean;
  /** JSON-LD structured data object */
  jsonLd?: Record<string, unknown>;
}

const SITE_NAME = "GameTaverns";
const DEFAULT_DESCRIPTION =
  "Create and explore board game libraries — track collections, log plays, manage lending, and build your gaming community.";
const DEFAULT_OG_IMAGE = "https://gametaverns.com/gt-logo.png";
const SITE_URL = "https://gametaverns.com";

function setMeta(property: string, content: string, isName = false) {
  const attr = isName ? "name" : "property";
  let el = document.querySelector(`meta[${attr}="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(data: Record<string, unknown>) {
  const id = "structured-data-jsonld";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * SEO component — imperatively manages <head> meta tags without a library dependency.
 * Place inside any page component; it will update tags on mount and clean up on unmount.
 */
export function SEO({
  title,
  description = DEFAULT_DESCRIPTION,
  canonical,
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  noIndex = false,
  noSuffix = false,
  jsonLd,
}: SEOProps) {
  const fullTitle = noSuffix ? title : `${title} | ${SITE_NAME}`;
  const resolvedCanonical = canonical ?? (typeof window !== "undefined" ? window.location.href : SITE_URL);

  useEffect(() => {
    // <title>
    document.title = fullTitle;

    // Basic meta
    setMeta("description", description, true);
    setMeta("robots", noIndex ? "noindex,nofollow" : "index,follow", true);

    // Open Graph
    setMeta("og:title", fullTitle);
    setMeta("og:description", description);
    setMeta("og:type", ogType);
    setMeta("og:image", ogImage);
    setMeta("og:url", resolvedCanonical);
    setMeta("og:site_name", SITE_NAME);

    // Twitter / X
    setMeta("twitter:card", "summary_large_image", true);
    setMeta("twitter:title", fullTitle, true);
    setMeta("twitter:description", description, true);
    setMeta("twitter:image", ogImage, true);

    // Canonical
    setLink("canonical", resolvedCanonical);

    // JSON-LD
    if (jsonLd) setJsonLd(jsonLd);

    return () => {
      // Restore defaults on unmount
      document.title = SITE_NAME;
    };
  }, [fullTitle, description, resolvedCanonical, ogImage, ogType, noIndex, jsonLd]);

  return null;
}

// ─── Convenience factory for WebSite JSON-LD (homepage) ───────────────────────
export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/catalog?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

// ─── Convenience factory for library/Organization JSON-LD ─────────────────────
export function libraryJsonLd(opts: {
  name: string;
  description?: string | null;
  url: string;
  logoUrl?: string | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: opts.name,
    description: opts.description ?? undefined,
    url: opts.url,
    ...(opts.logoUrl ? { logo: opts.logoUrl } : {}),
  };
}

// ─── Convenience factory for game/Product JSON-LD ────────────────────────────
export function gameJsonLd(opts: {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  url: string;
  minPlayers?: number | null;
  maxPlayers?: number | null;
  playTime?: string | null;
  rating?: number | null;
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: opts.name,
    description: opts.description ?? undefined,
    image: opts.imageUrl ?? undefined,
    url: opts.url,
    ...(opts.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: opts.rating.toFixed(1),
            bestRating: "5",
            worstRating: "1",
          },
        }
      : {}),
    additionalProperty: [
      opts.minPlayers && {
        "@type": "PropertyValue",
        name: "Minimum Players",
        value: opts.minPlayers,
      },
      opts.maxPlayers && {
        "@type": "PropertyValue",
        name: "Maximum Players",
        value: opts.maxPlayers,
      },
      opts.playTime && {
        "@type": "PropertyValue",
        name: "Play Time",
        value: opts.playTime,
      },
    ].filter(Boolean),
  };
}

// ─── Convenience factory for CollectionPage JSON-LD (library pages) ──────────
export function collectionPageJsonLd(opts: {
  name: string;
  description?: string | null;
  url: string;
  logoUrl?: string | null;
  gameCount?: number;
  location?: { city?: string | null; region?: string | null; country?: string | null };
}): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description ?? `Board game library — ${opts.name}`,
    url: opts.url,
    ...(opts.logoUrl ? { image: opts.logoUrl } : {}),
    mainEntity: {
      "@type": "ItemList",
      name: `${opts.name} Game Collection`,
      numberOfItems: opts.gameCount ?? 0,
    },
    ...(opts.location?.city || opts.location?.region || opts.location?.country
      ? {
          contentLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              ...(opts.location.city ? { addressLocality: opts.location.city } : {}),
              ...(opts.location.region ? { addressRegion: opts.location.region } : {}),
              ...(opts.location.country ? { addressCountry: opts.location.country } : {}),
            },
          },
        }
      : {}),
  };
}