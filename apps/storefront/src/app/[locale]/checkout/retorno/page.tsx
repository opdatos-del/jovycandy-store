import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"

import { VerifyCheckoutOrder } from "@/features/commerce/verify-checkout-order"
import { isLocale } from "@/lib/i18n"

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}

export default async function CheckoutReturn({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  // Stripe puede anexar un client secret. No se usa, no se propaga y no
  // se renderiza: la comprobación usa el carrito de la cookie HttpOnly.
  if (Object.keys(await searchParams).length) redirect(`/${locale}/checkout/retorno`)

  return <main className="mx-auto max-w-xl px-4 pb-20 pt-32">
    <VerifyCheckoutOrder locale={locale} />
  </main>
}

export const instant = false
