"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState } from "react"

import type { Locale } from "@/lib/i18n"
import { useCommerce } from "./cart-provider"

export function VerifyCheckoutOrder({ locale }: { locale: Locale }) {
  const router = useRouter()
  const { refresh } = useCommerce()
  const spanish = locale === "es"
  const active = useRef(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function verify() {
    if (active.current) return
    active.current = true
    setBusy(true)
    setFailed(false)
    try {
      const response = await fetch("/api/checkout/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      })
      const payload = await response.json()
      if (!response.ok || !payload?.order?.id) throw new Error()
      router.replace(`/${locale}/checkout/confirmacion`)
      void refresh()
    } catch {
      setFailed(true)
      active.current = false
      setBusy(false)
    }
  }

  return <section className="grid gap-4 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-6">
    <h1 className="text-2xl font-black text-[#0d3b6e]">{spanish ? "Estado del pedido" : "Order status"}</h1>
    <p className="text-sm text-[#5b6f82]">{spanish
      ? "Consulta si tu pedido quedó confirmado. Si autorizaste el pago, no vuelvas a pagar sin verificarlo."
      : "Check whether your order was confirmed. If you authorized the payment, verify it before trying again."}</p>
    <button type="button" disabled={busy} onClick={() => void verify()}
      className="min-h-12 rounded-full bg-[#0d3b6e] px-6 text-sm font-black text-white disabled:opacity-50">
      {busy ? (spanish ? "Consultando…" : "Checking…") : (spanish ? "Consultar pedido" : "Check order")}
    </button>
    <p aria-live="polite" className="text-sm text-red-700">{failed ? (spanish
      ? "Aún no pudimos confirmar un pedido para este carrito. Vuelve a consultar en unos momentos."
      : "We couldn't confirm an order for this cart yet. Check again in a moment.") : ""}</p>
    <Link href={`/${locale}/checkout`} className="text-sm text-[#0d3b6e] underline">
      {spanish ? "Volver al checkout" : "Back to checkout"}
    </Link>
  </section>
}
