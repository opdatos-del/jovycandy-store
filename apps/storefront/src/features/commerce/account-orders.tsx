"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import { formatMoney } from "@/lib/commerce/format"
import type { Dictionary, Locale } from "@/lib/i18n"
import type { CustomerOrder } from "@/lib/medusa/customer"

import { jsonRequest } from "./account-request"
import { useCommerce } from "./cart-provider"

type OrdersPage = { orders: CustomerOrder[]; count: number; limit: number; offset: number }
type ReorderReport = { added: number; skipped: Array<{ id: string; title: string; reason: string }> }

const action = "inline-flex min-h-11 items-center text-xs font-bold text-[#0d3b6e] underline underline-offset-4 disabled:opacity-50"

function statusLabel(status: string, spanish: boolean) {
  const labels: Record<string, [string, string]> = {
    pending: ["Pendiente", "Pending"], completed: ["Completado", "Completed"],
    canceled: ["Cancelado", "Canceled"], authorized: ["Autorizado", "Authorized"],
    captured: ["Capturado", "Captured"], partially_captured: ["Capturado en parte", "Partially captured"],
    refunded: ["Reembolsado", "Refunded"], partially_refunded: ["Reembolso parcial", "Partially refunded"],
    shipped: ["Enviado", "Shipped"], delivered: ["Entregado", "Delivered"],
    fulfilled: ["Preparado", "Fulfilled"], not_paid: ["Sin pago", "Not paid"],
  }
  return labels[status]?.[spanish ? 0 : 1] ?? status.replaceAll("_", " ")
}

export function AccountOrders({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const [page, setPage] = useState<OrdersPage>()
  const [offset, setOffset] = useState(0)
  const [retry, setRetry] = useState(0)
  const [error, setError] = useState("")
  const [adding, setAdding] = useState(false)
  const [report, setReport] = useState<ReorderReport>()
  const inFlight = useRef(false)
  const { refresh } = useCommerce()
  const spanish = locale === "es"
  const date = new Intl.DateTimeFormat(spanish ? "es-MX" : "en", { timeZone: "America/Mexico_City", dateStyle: "medium" })

  useEffect(() => {
    const controller = new AbortController()
    void jsonRequest<OrdersPage>(`/api/account/orders?offset=${offset}`, { signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setPage(result) })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : dictionary.commerce.error)
      })
    return () => controller.abort()
  }, [offset, retry, dictionary.commerce.error])

  function navigate(next: number) {
    setError("")
    setPage(undefined)
    setOffset(next)
  }

  async function buyAgain(order: CustomerOrder) {
    if (inFlight.current) return
    inFlight.current = true
    setAdding(true)
    setReport(undefined)
    setError("")
    try {
      setReport(await jsonRequest<ReorderReport>(
        `/api/account/orders/${encodeURIComponent(order.id)}`, { method: "POST" },
      ))
      await refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : dictionary.commerce.error)
    } finally {
      inFlight.current = false
      setAdding(false)
    }
  }

  return <section id="pedidos" className="scroll-mt-28 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
    <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{dictionary.account.orders}</h2>
    {!page && !error ? <p role="status" className="mt-3 text-sm text-[#5b6f82]">{dictionary.commerce.loading}</p> : null}
    {page && !page.orders.length ? <div className="mt-3 text-sm text-[#5b6f82]">
      <p>{dictionary.account.noOrders}</p>
      <Link href={`/${locale}/catalogo`} className={action}>{dictionary.commerce.backToCatalog}</Link>
    </div> : null}
    {page?.orders.length ? <ul className="mt-4 grid gap-3">
      {page.orders.map((order) => <li key={order.id} className="rounded-xl border border-[#0d3b6e]/10 bg-white p-3 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="break-all font-bold">#{order.displayId ?? order.id}</span>
          <span className="font-black">{formatMoney(order.total, order.currencyCode, locale)}</span>
        </div>
        <p className="mt-1 text-xs text-[#5b6f82]">
          {order.createdAt ? `${date.format(new Date(order.createdAt))} · ` : ""}{statusLabel(order.status, spanish)}
        </p>
        {order.paymentStatus ? <p className="mt-1 text-xs text-[#5b6f82]">
          {spanish ? "Pago" : "Payment"}: {statusLabel(order.paymentStatus, spanish)}
        </p> : null}
        {order.fulfillmentStatus && order.fulfillmentStatus !== "not_fulfilled" ? <p className="mt-1 text-xs text-[#5b6f82]">
          {spanish ? "Envío" : "Fulfillment"}: {statusLabel(order.fulfillmentStatus, spanish)}
        </p> : null}
        {order.items.length ? <details>
          <summary className="min-h-11 cursor-pointer py-3 text-xs font-bold text-[#0d3b6e] underline">
            {spanish ? "Ver detalle" : "View details"}
          </summary>
          <ul className="grid gap-2 border-t border-[#0d3b6e]/10 pt-3">
            {order.items.map((item) => <li key={item.id}>{item.quantity} × {item.title}{item.variantTitle ? ` · ${item.variantTitle}` : ""}</li>)}
          </ul>
          <button type="button" disabled={adding} className={action} onClick={() => void buyAgain(order)}>
            {spanish ? "Volver a comprar" : "Buy again"}
          </button>
        </details> : null}
      </li>)}
    </ul> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    {error && !page ? <button type="button" className={action} onClick={() => { setError(""); setRetry(retry + 1) }}>
      {spanish ? "Reintentar" : "Try again"}
    </button> : null}
    {report ? <div role="status" className="mt-4 rounded-lg bg-[#eafaf6] p-3 text-sm text-[#075a49]">
      <p>{spanish ? `Unidades agregadas: ${report.added}` : `Units added: ${report.added}`}</p>
      {report.skipped.map((item) => <p key={item.id}>{item.title}: {item.reason === "unavailable"
        ? (spanish ? "No disponible" : "Unavailable")
        : (spanish ? "No se pudo verificar; revisa tu carrito" : "Not verified; check your cart")}</p>)}
      <Link href={`/${locale}/carrito`} className={action}>{spanish ? "Ver carrito" : "View cart"}</Link>
    </div> : null}
    {page && (page.count > page.limit || page.offset > 0) ? <div className="mt-4 flex items-center justify-between gap-3">
      <button type="button" disabled={!page.offset} className={action}
        onClick={() => navigate(Math.max(0, page.offset - page.limit))}>{spanish ? "Anterior" : "Previous"}</button>
      <button type="button" disabled={page.offset + page.limit >= page.count} className={action}
        onClick={() => navigate(page.offset + page.limit)}>{spanish ? "Siguiente" : "Next"}</button>
    </div> : null}
  </section>
}
