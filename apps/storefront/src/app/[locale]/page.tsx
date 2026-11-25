import { AboutSection } from "@/components/home/about-section"
import { CasaJovy } from "@/components/home/casa-jovy"
import { CategoryExplorer } from "@/components/home/category-explorer"
import { Certifications } from "@/components/home/certifications"
import { EventsSection } from "@/components/home/events-section"
import { HeroPromo } from "@/components/home/hero-promo"
import { ScrollLogo } from "@/components/home/scroll-logo"
import { getHomeContent, FALLBACK_PRODUCTS } from "@/lib/cms/client"
import {
  isOfficialCatalogHandle,
  OFFICIAL_CATALOG_EXPECTED_PRODUCTS,
  selectCatalogProducts,
} from "@/lib/commerce/product-presentations"
import { getDictionary, isLocale } from "@/lib/i18n"
import { notFound } from "next/navigation"

type HomePageProps = {
  params: Promise<{ locale: string }>
}

export default async function HomePage({ params }: HomePageProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dictionary = getDictionary(locale)
  const content = await getHomeContent(locale)
  const products = selectCatalogProducts(content.products)
  const hasOfficialProducts =
    products.length === OFFICIAL_CATALOG_EXPECTED_PRODUCTS &&
    products.every((product) => isOfficialCatalogHandle(product.handle))
  const homeContent = { ...content, products }
  const fallbackProducts = hasOfficialProducts ? [] : FALLBACK_PRODUCTS

  return (
    <main id="contenido" className="relative bg-[#fff5d4] selection:bg-[#0d3b6e] selection:text-white">
      <ScrollLogo />
      <HeroPromo locale={locale} dictionary={dictionary} content={homeContent} fallbackProducts={fallbackProducts} />
      <EventsSection content={content} dictionary={dictionary} />
      <Certifications dictionary={dictionary} />
      <CategoryExplorer locale={locale} dictionary={dictionary} categories={content.categories} products={products} fallbackProducts={fallbackProducts} />
      <div aria-hidden="true" className="h-[clamp(1.25rem,3vw,2.5rem)] bg-white" />
      <CasaJovy dictionary={dictionary} gallery={content.gallery} />
      <AboutSection dictionary={dictionary} />
    </main>
  )
}
