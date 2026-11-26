import type { MetadataRoute } from "next"

import { getHomeContent } from "@/lib/cms/client"
import { locales } from "@/lib/i18n"
import { listCommerceCollections } from "@/lib/medusa/store"
import { SITE_URL } from "@/lib/site"

const base = SITE_URL

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const content = await getHomeContent("es")
  const collections = await listCommerceCollections().catch(() => [])
  const pages: MetadataRoute.Sitemap = locales.flatMap((locale) => [
    { url: `${base}/${locale}`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/${locale}/catalogo`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/${locale}/colecciones`, changeFrequency: "weekly", priority: 0.5 },
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

  const collectionPages = collections.flatMap((collection) =>
    locales.map((locale) => ({
      url: `${base}/${locale}/colecciones/${collection.handle}`,
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
  )

  return [...pages, ...products, ...collectionPages]
}
