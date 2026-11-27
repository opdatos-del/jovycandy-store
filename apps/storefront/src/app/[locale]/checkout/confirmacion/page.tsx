import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { formatMoney } from "@/lib/commerce/format"
import { getDictionary, isLocale } from "@/lib/i18n"
import { readCompletedOrderCookie } from "@/lib/medusa/cart-session"

type ConfirmRouteProps = { params: Promise<{ locale: string }> }

export const metadata: Metadata = {
  title: "Pedido confirmado | JovyCandy",
  robots: { index: false, follow: false, noarchive: true, nocache: true },
}

export default async function ConfirmationRoute({ params }: ConfirmRouteProps) {
  const { locale } = await params
  if (!isLocale(locale)) notFound()
  const dictionary = getDictionary(locale)
  const copy = dictionary.commerce
  const order = await readCompletedOrderCookie()

  if (!order) {
    return (
      <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
        <div className="mx-auto grid max-w-xl place-items-center gap-5 px-4 py-24 text-center">
          <h1 className="text-3xl font-black uppercase tracking-tight text-[#0d3b6e]">
            {locale === "es" ? "No hay un pedido confirmado" : "No confirmed order"}
          </h1>
          <p className="text-sm leading-7 text-[#5b6f82]">{locale === "es"
            ? "No encontramos una confirmación reciente en esta sesión."
            : "We couldn't find a recent confirmation in this session."}</p>
          <Link
            href={`/${locale}/catalogo`}
            className="inline-flex min-h-12 items-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white"
          >
            {copy.backToCatalog}
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-[#fffaf0] pb-20 pt-28 sm:pt-32">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="jovy-animate-in rounded-2xl border border-[#00afaa]/40 bg-white p-6 sm:p-8">
          <span className="confirmation-check" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" width="34" height="34">
              <path d="m5 12.5 4.2 4.2L19 6.5" />
            </svg>
          </span>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-tight text-[#0d3b6e] sm:text-4xl">
            {copy.orderConfirmed}
          </h1>
          <p className="mt-3 text-sm leading-7 text-[#5b6f82]">{copy.confirmationLead}</p>

          <dl className="mt-6 grid gap-3 border-y border-[#0d3b6e]/12 py-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#5b6f82]">
                {copy.orderNumber}
              </dt>
              <dd className="mt-1 font-black">#{order.displayId ?? order.id}</dd>
            </div>
            <div>
              <dt className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#5b6f82]">
                {copy.orderStatus}
              </dt>
              <dd className="mt-1 font-black">{order.status}</dd>
            </div>
          </dl>

          <h2 className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
            {copy.orderSummary}
          </h2>
          <ul className="mt-3 grid gap-3">
            {order.items.map((item, index) => (
              <li key={`${item.title}-${index}`} className="flex justify-between gap-4 border-b border-[#0d3b6e]/10 pb-3 text-sm">
                <span>
                  {item.quantity} × {item.title}
                  {item.variantTitle ? <span className="block text-xs text-[#5b6f82]">{item.variantTitle}</span> : null}
                </span>
                <span className="shrink-0 font-black">
                  {formatMoney(item.total, order.currencyCode, locale)}
                </span>
              </li>
            ))}
          </ul>
          <dl className="mt-4 grid gap-2 border-t border-[#0d3b6e]/12 pt-4 text-sm">
            <div className="flex justify-between gap-4 text-[#5b6f82]">
              <dt>{copy.subtotal}</dt>
              <dd>{formatMoney(order.subtotal, order.currencyCode, locale)}</dd>
            </div>
            {order.discountTotal ? (
              <div className="flex justify-between gap-4 text-[#007f7b]">
                <dt>{copy.discount}</dt>
                <dd>-{formatMoney(order.discountTotal, order.currencyCode, locale)}</dd>
              </div>
            ) : null}
            {order.shippingTotal ? (
              <div className="flex justify-between gap-4 text-[#5b6f82]">
                <dt>{copy.shipping}</dt>
                <dd>{formatMoney(order.shippingTotal, order.currencyCode, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-[#0d3b6e]/12 pt-2 text-base font-black">
              <span>{copy.total}</span>
              <span>{formatMoney(order.total, order.currencyCode, locale)}</span>
            </div>
          </dl>
          <Link
            href={`/${locale}/catalogo`}
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white"
          >
            {copy.backToCatalog}
          </Link>
        </div>
      </div>
    </main>
  )
}

export const instant = false
