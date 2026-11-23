"use client"

import Link from "next/link"
import { useEffect, useRef } from "react"

import { formatMoney } from "@/lib/commerce/format"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"

export function CartDrawer({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const { cart, open, setOpen, loading, mutating, error, updateItem, removeItem } = useCommerce()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const copy = dictionary.commerce

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-label={copy.cart}
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-md bg-[#fffdf7] p-0 text-[#202a35] shadow-2xl backdrop:bg-[#082f59]/55 backdrop:backdrop-blur-sm"
    >
      <div className="flex h-full flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-[#0d3b6e]/15 px-5 py-4">
          <div>
            <p className="text-[0.62rem] font-black uppercase tracking-[0.18em] text-[#0d3b6e]">
              {copy.cart}
            </p>
            <h2 id="cart-drawer-title" className="mt-1 text-xl font-black uppercase tracking-tight">
              {cart?.itemCount
                ? `${cart.itemCount} ${cart.itemCount === 1 ? copy.item : copy.items}`
                : copy.emptyCart}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={copy.closeCart}
            className="grid h-11 w-11 place-items-center rounded-full bg-[#eef4f8] text-xl"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="py-10 text-center text-sm text-[#5b6f82]">{copy.loading}</p>
          ) : !cart || !cart.items.length ? (
            <div className="grid place-items-center gap-4 py-16 text-center">
              <p className="text-lg font-bold">{copy.emptyCart}</p>
              <p className="max-w-xs text-sm leading-6 text-[#5b6f82]">{copy.emptyCartLead}</p>
              <Link
                href={`/${locale}/catalogo`}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center rounded-full bg-[#0d3b6e] px-5 text-xs font-black uppercase tracking-[0.08em] text-white"
              >
                {copy.continueShopping}
              </Link>
            </div>
          ) : (
            <ul className="grid gap-4">
              {cart.items.map((item) => (
                <li key={item.id} className="grid grid-cols-[72px_1fr] gap-3 border-b border-[#0d3b6e]/10 pb-4">
                  <div className="grid aspect-square place-items-center overflow-hidden rounded-lg bg-[#eef4f8]">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt=""
                        width={72}
                        height={72}
                        className="h-full w-full object-contain p-1.5"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{item.productTitle}</p>
                    <p className="mt-0.5 text-xs text-[#5b6f82]">{item.variantTitle}</p>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-full border border-[#0d3b6e]/20 bg-white">
                        <button
                          type="button"
                          aria-label={copy.decrease}
                          disabled={mutating || item.quantity <= 1}
                          onClick={() => void updateItem(item.id, item.quantity - 1).catch(() => undefined)}
                          className="grid h-9 w-9 place-items-center text-base disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-6 text-center text-xs font-black">{item.quantity}</span>
                        <button
                          type="button"
                          aria-label={copy.increase}
                          disabled={mutating || item.quantity >= 99}
                          onClick={() => void updateItem(item.id, item.quantity + 1).catch(() => undefined)}
                          className="grid h-9 w-9 place-items-center text-base disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-black">
                        {formatMoney(item.total, cart.currencyCode, locale)}
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={mutating}
                      onClick={() => void removeItem(item.id).catch(() => undefined)}
                      className="mt-2 text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#b4234a] underline underline-offset-2 disabled:opacity-40"
                    >
                      {copy.remove}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        {cart?.items.length ? (
          <footer className="border-t border-[#0d3b6e]/15 bg-white px-5 py-4">
            <dl className="grid gap-2 text-sm">
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
              <div className="flex justify-between gap-4 border-t border-[#0d3b6e]/10 pt-2 text-base font-black">
                <dt>{copy.total}</dt>
                <dd>{formatMoney(cart.total, cart.currencyCode, locale)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[0.65rem] leading-4 text-[#5b6f82]">{copy.demoNote}</p>
            <div className="mt-3 grid gap-2">
              <Link
                href={`/${locale}/carrito`}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#0d3b6e] px-5 text-xs font-black uppercase tracking-[0.08em] text-[#0d3b6e]"
              >
                {copy.viewCart}
              </Link>
              <Link
                href={`/${locale}/checkout`}
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#0d3b6e] px-5 text-xs font-black uppercase tracking-[0.08em] text-white"
              >
                {copy.checkout}
              </Link>
            </div>
          </footer>
        ) : null}
      </div>
    </dialog>
  )
}
