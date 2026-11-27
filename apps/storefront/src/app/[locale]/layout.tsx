import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ContactDialog } from "@/components/dialogs/contact-dialog"
import { LocationDialog } from "@/components/dialogs/location-dialog"
import { UpcomingEventsDialog } from "@/components/dialogs/upcoming-events-dialog"
import { SiteFooter } from "@/components/layout/site-footer"
import { SiteHeader } from "@/components/layout/site-header"
import { CartDrawer } from "@/features/commerce/cart-drawer"
import { CommerceProvider } from "@/features/commerce/cart-provider"
import { ToastProvider } from "@/features/commerce/toast-provider"
import { getHomeContent } from "@/lib/cms/client"
import { getDictionary, isLocale, locales, type Locale } from "@/lib/i18n"
import { SITE_URL } from "@/lib/site"

import "../globals.css"
import "@/styles/commerce/commerce.css"

type LocaleLayoutProps = {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    title: "Jovy Candy | Dulces mexicanos",
    description: "Descubre el catálogo de dulces, gomitas, chamoy y productos Jovy Candy.",
    metadataBase: new URL(SITE_URL),
    alternates: {
      canonical: `/${locale}`,
      languages: { es: "/es", en: "/en" },
    },
    openGraph: {
      title: "Jovy Candy | Dulces mexicanos",
      description: "Descubre el catálogo de dulces, gomitas, chamoy y productos Jovy Candy.",
      locale: locale === "en" ? "en_US" : "es_MX",
      type: "website",
    },
  }
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()

  const dictionary = getDictionary(locale as Locale)
  const content = await getHomeContent(locale as Locale)

  return (
    <html lang={locale} data-scroll-behavior="smooth">
      <body className="bg-[#fff5d4]">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#0d3b6e] focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white"
        >
          {locale === "es" ? "Saltar al contenido" : "Skip to content"}
        </a>
        <ToastProvider>
          <CommerceProvider>
            <SiteHeader locale={locale as Locale} dictionary={dictionary} />
            <UpcomingEventsDialog banners={content.promo} events={content.events} dictionary={dictionary} />
            {children}
            <SiteFooter locale={locale as Locale} dictionary={dictionary} />
            <ContactDialog locale={locale as Locale} dictionary={dictionary} />
            <LocationDialog locale={locale as Locale} dictionary={dictionary} />
            <CartDrawer locale={locale as Locale} dictionary={dictionary} />
          </CommerceProvider>
        </ToastProvider>
      </body>
    </html>
  )
}
