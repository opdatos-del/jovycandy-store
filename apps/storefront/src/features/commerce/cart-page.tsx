"use client"

import Link from "next/link"
import { useEffect } from "react"

import { formatMoney } from "@/lib/commerce/format"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"

export function CartPage({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const copy = dictionary.commerce
  const { cart, loading, mutating, error, refresh, updateItem, removeItem } = useCommerce()

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading && !cart) {
    return <p className="mx-auto max-w-6xl px-4 py-20 text-center text-sm text-[#5b6f82]">{copy.loading}</p>
  }

  if (!cart || !cart.items.length) {
    return (
      <div className="mx-auto grid max-w-2xl place-items-center gap-5 px-4 py-24 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#0d3b6e]">{copy.emptyCart}</h1>
        <p className="max-w-md text-sm leading-7 text-[#5b6f82]">{copy.emptyCartLead}</p>
        <Link
          href={`/${locale}/catalogo`}
          className="inline-flex min-h-12 items-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white"
        >
          {copy.continueShopping}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#b4234a]">
          {dictionary.catalog.catalogBreadcrumb} · JovyCandy
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-[#0d3b6e]">
          {copy.cart}
        </h1>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <ul className="grid gap-4">
          {cart.items.map((item) => (
            <li
              key={item.id}
              className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-b border-[#0d3b6e]/12 pb-5"
            >
              <div className="grid aspect-square place-items-center overflow-hidden rounded-xl bg-[#eef4f8]">
                {item.thumbnail ? (
                  <img src={item.thumbnail} alt="" width={88} height={88} className="h-full w-full object-contain p-2" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-black text-[#202a35]">{item.productTitle}</p>
                <p className="mt-1 text-xs text-[#5b6f82]">{item.variantTitle}</p>
                <p className="mt-1 text-sm font-black">{formatMoney(item.unitPrice, cart.currencyCode, locale)}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center rounded-full border border-[#0d3b6e]/20 bg-white">
                    <button
                      type="button"
                      aria-label={copy.decrease}
                      disabled={mutating || item.quantity <= 1}
                      onClick={() => void updateItem(item.id, item.quantity - 1).catch(() => undefined)}
                      className="grid h-10 w-10 place-items-center text-lg disabled:opacity-40"
                    >
                      −
                    </button>
                    <span className="min-w-7 text-center text-xs font-black">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label={copy.increase}
                      disabled={mutating || item.quantity >= 99}
                      onClick={() => void updateItem(item.id, item.quantity + 1).catch(() => undefined)}
                      className="grid h-10 w-10 place-items-center text-lg disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-black">
                      {formatMoney(item.total, cart.currencyCode, locale)}
                    </span>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => void removeItem(item.id).catch(() => undefined)}
                      className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[#b4234a] underline underline-offset-2 disabled:opacity-40"
                    >
                      {copy.remove}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
            {copy.orderSummary}
          </h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4 text-[#5b6f82]">
              <dt>{copy.subtotal}</dt>
              <dd>{formatMoney(cart.subtotal, cart.currencyCode, locale)}</dd>
            </div>
            {cart.shippingTotal ? (
              <div className="flex justify-between gap-4 text-[#5b6f82]">
                <dt>{copy.shipping}</dt>
                <dd>{formatMoney(cart.shippingTotal, cart.currencyCode, locale)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between gap-4 border-t border-[#0d3b6e]/12 pt-3 text-base font-black">
              <dt>{copy.total}</dt>
              <dd>{formatMoney(cart.total, cart.currencyCode, locale)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[0.68rem] leading-5 text-[#5b6f82]">{copy.demoNote}</p>
          {error ? <p role="alert" className="mt-3 text-xs text-red-700">{error}</p> : null}
          <Link
            href={`/${locale}/checkout`}
            className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#0d3b6e] px-5 text-xs font-black uppercase tracking-[0.1em] text-white"
          >
            {copy.checkout}
          </Link>
          <Link
            href={`/${locale}/catalogo`}
            className="mt-2 inline-flex min-h-10 w-full items-center justify-center text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[#0d3b6e] underline underline-offset-4"
          >
            {copy.continueShopping}
          </Link>
        </aside>
      </div>
    </div>
  )
}
