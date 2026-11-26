import type { MetadataRoute } from "next"

import { getHomeContent } from "@/lib/cms/client"
import { locales } from "@/lib/i18n"
import { SITE_URL } from "@/lib/site"

const base = SITE_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getHomeContent("es")
  const pages: MetadataRoute.Sitemap = locales.flatMap((locale) => [
    { url: `${base}/${locale}`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/${locale}/catalogo`, changeFrequency: "weekly", priority: 0.8 },
  ])

  const products = content.products
    .filter((product) => Boolean(product.handle))
    .flatMap((product) =>
      locales.map((locale) => ({
        url: `${base}/${locale}/productos/${product.handle}`,
        changeFrequency: "monthly" as const,
        priority: 0.6,
      })),
    )

  return [...pages, ...products]
}
