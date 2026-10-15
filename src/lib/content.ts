import { getCollection, type CollectionEntry } from "astro:content";
import { BLOG_CATEGORIES, type BlogCategory } from "../content.config";

/* ============================================================================
   Blog and Ratgeber helpers — sorting, reading time, date format. Build-time
   only (astro:content).
   ============================================================================ */

export type Post = CollectionEntry<"blog">;
export type Guide = CollectionEntry<"ratgeber">;

/** Newest first. */
export async function getPosts(): Promise<Post[]> {
  return (await getCollection("blog")).sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getGuides(): Promise<Guide[]> {
  return (await getCollection("ratgeber")).sort((a, b) => a.data.order - b.data.order);
}

/** Categories that have at least one post — the others stay hidden. */
export function usedCategories(posts: Post[]): { key: BlogCategory; label: string; count: number }[] {
  return (Object.keys(BLOG_CATEGORIES) as BlogCategory[])
    .map((key) => ({ key, label: BLOG_CATEGORIES[key], count: posts.filter((p) => p.data.category === key).length }))
    .filter((c) => c.count > 0);
}

/** Minutes at 200 words per minute, from the raw MDX body. */
export function readingMinutes(body: string | undefined): number {
  const words = (body ?? "")
    .replace(/^import .*$/gm, "")
    .replace(/<[^>]+>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** «15. Oktober 2026» */
export const fmtLongDate = (d: Date): string =>
  d.toLocaleDateString("de-CH", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
