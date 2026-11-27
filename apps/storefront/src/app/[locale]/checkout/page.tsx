import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { CheckoutPage } from "@/features/commerce/checkout-page"
import { getDictionary, isLocale } from "@/lib/i18n"
import { getCartId } from "@/lib/medusa/cart-session"
import { checkoutPaymentMode } from "@/lib/medusa/checkout-payment-contract"
import { getCustomer } from "@/lib/medusa/customer"
import { getCustomerToken } from "@/lib/medusa/customer-session"
import { getCheckoutDraft } from "@/lib/medusa/store"

type CheckoutRouteProps = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "Checkout | JovyCandy",
  robots: { index: false, follow: false },
}

export default async function CheckoutRoute({ params }: CheckoutRouteProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const [token, cartId] = await Promise.all([getCustomerToken(), getCartId()])
  const [customer, draft] = await Promise.all([
    token ? getCustomer(token).catch(() => null) : null,
    cartId ? getCheckoutDraft(cartId).catch(() => null) : null,
  ])
  return (
    <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
      <CheckoutPage locale={locale} dictionary={getDictionary(locale)}
        customer={customer} draft={draft} paymentMode={checkoutPaymentMode(process.env)} />
    </main>
  )
}

export const instant = false
