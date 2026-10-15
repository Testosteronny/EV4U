import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

/* ============================================================================
   Wissen — two content collections (Konzept v3 §4.10), MDX in the repo,
   published with a push like everything else.

   · blog: dated posts, organised by date and category
   · ratgeber: evergreen guides, updated in place
   ============================================================================ */

export const BLOG_CATEGORIES = {
  marktbericht: "Marktbericht",
  "neue-modelle": "Neue Modelle",
  "laden-energie": "Laden & Energie",
  "politik-foerderung": "Politik & Förderung",
  erfahrungen: "Erfahrungen",
} as const;

export type BlogCategory = keyof typeof BLOG_CATEGORIES;

const blog = defineCollection({
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string().max(110),
    description: z.string().max(240),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.enum(Object.keys(BLOG_CATEGORIES) as [BlogCategory, ...BlogCategory[]]),
    tags: z.array(z.string()).default([]),
    /** Catalog model slugs (vehicle_models.slug) → «passende Inserate». */
    models: z.array(z.string()).default([]),
    author: z.string().default("Redaktion EV4U"),
    featured: z.boolean().default(false),
  }),
});

const ratgeber = defineCollection({
  loader: glob({ pattern: "**/[^_]*.mdx", base: "./src/content/ratgeber" }),
  schema: z.object({
    title: z.string().max(110),
    description: z.string().max(240),
    updated: z.coerce.date(),
    /** Position on /ratgeber. */
    order: z.number().int(),
    /** Who the guide is for — shown as a small label. */
    audience: z.enum(["Kaufen", "Verkaufen", "Laden", "Alle"]),
  }),
});

export const collections = { blog, ratgeber };
