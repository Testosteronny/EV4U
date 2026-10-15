import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { BLOG_CATEGORIES } from "../content.config";
import { getPosts } from "../lib/content";

/* /rss.xml — the blog feed. */
export async function GET(context: APIContext) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const posts = await getPosts();
  return rss({
    title: "EV4U Blog",
    description: "Gebrauchte E-Autos in der Schweiz: Strompreise, Laden, Batterien und neue Modelle.",
    site: new URL(`${base}/`, context.site).href,
    items: posts.map((p) => ({
      title: p.data.title,
      description: p.data.description,
      pubDate: p.data.date,
      link: `${base}/blog/${p.id}`,
      categories: [BLOG_CATEGORIES[p.data.category], ...p.data.tags],
    })),
    customData: "<language>de-ch</language>",
  });
}
