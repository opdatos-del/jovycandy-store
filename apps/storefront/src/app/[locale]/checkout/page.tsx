import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CheckoutPage } from "@/features/commerce/checkout-page"
import { getDictionary, isLocale } from "@/lib/i18n"

type CheckoutRouteProps = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "Checkout | JovyCandy",
  robots: { index: false, follow: false },
}

export default async function CheckoutRoute({ params }: CheckoutRouteProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  return (
    <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
      <CheckoutPage locale={locale} dictionary={getDictionary(locale)} />
    </main>
  )
}

export const instant = false
