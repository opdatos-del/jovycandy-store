"use client"

import { useEffect, useState } from "react"

import type { Locale } from "@/lib/i18n"
import type { CustomerNotice } from "@/lib/medusa/customer"

import { jsonRequest } from "./account-request"

type NoticeFeed = { notices: CustomerNotice[]; marketingEmail: boolean }
const action = "inline-flex min-h-11 items-center text-xs font-bold text-[#0d3b6e] underline disabled:opacity-50"

export function AccountNotices({ locale }: { locale: Locale }) {
  const spanish = locale === "es"
  const [feed, setFeed] = useState<NoticeFeed>()
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const date = new Intl.DateTimeFormat(spanish ? "es-MX" : "en", { timeZone: "America/Mexico_City", dateStyle: "medium" })

  useEffect(() => {
    const controller = new AbortController()
    void jsonRequest<NoticeFeed>("/api/account/notices", { signal: controller.signal })
      .then((data) => { if (!controller.signal.aborted) setFeed(data) })
      .catch(() => { if (!controller.signal.aborted) setFailed(true) })
    return () => controller.abort()
  }, [])

  async function save(body: { id: string } | { action: "set_marketing_email"; enabled: boolean }) {
    setBusy(true)
    setFailed(false)
    setMessage("")
    try {
      await jsonRequest("/api/account/notices", { method: "POST", body: JSON.stringify(body) })
      setFeed(await jsonRequest<NoticeFeed>("/api/account/notices"))
      setMessage(spanish ? "Cambio guardado." : "Change saved.")
    } catch {
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  return <section id="notificaciones" className="scroll-mt-28 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
    <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{spanish ? "Notificaciones" : "Notifications"}</h2>
    {!feed && !failed ? <p role="status" className="mt-3 text-sm text-[#5b6f82]">{spanish ? "Cargando…" : "Loading…"}</p> : null}
    {feed && !feed.notices.length ? <p className="mt-3 text-sm text-[#5b6f82]">
      {spanish ? "Aquí verás novedades de tus pedidos." : "You'll see updates about your orders here."}
    </p> : null}
    {feed?.notices.length ? <ul className="mt-4 grid gap-2">
      {feed.notices.map((notice) => <li key={notice.id} className="rounded-xl border border-[#0d3b6e]/10 bg-white p-3 text-sm">
        <p className="font-bold text-[#0d3b6e]">{notice.kind === "order_placed"
          ? (spanish ? "Pedido confirmado" : "Order confirmed")
          : (spanish ? "Pedido cancelado" : "Order canceled")}</p>
        <p className="text-xs text-[#5b6f82]">{date.format(new Date(notice.created_at))} · {notice.read_at
          ? (spanish ? "Leída" : "Read")
          : (spanish ? "Sin leer" : "Unread")}</p>
        {!notice.read_at ? <button type="button" disabled={busy} className={action} onClick={() => void save({ id: notice.id })}>
          {spanish ? "Marcar como leída" : "Mark as read"}
        </button> : null}
      </li>)}
    </ul> : null}
    {feed ? <form key={String(feed.marketingEmail)} className="mt-5 grid gap-2 border-t border-[#0d3b6e]/10 pt-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save({ action: "set_marketing_email", enabled: new FormData(event.currentTarget).has("marketing") })
      }}>
      <h3 className="font-bold text-[#0d3b6e]">{spanish ? "Preferencias de comunicación" : "Communication preferences"}</h3>
      <p className="text-sm text-[#5b6f82]">{spanish
        ? "Las novedades de pedidos aparecen en tu cuenta. Todavía no enviamos correos."
        : "Order updates appear in your account. We do not send emails yet."}</p>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="marketing" defaultChecked={feed.marketingEmail} className="h-5 w-5 accent-[#0d3b6e]" />
        {spanish ? "Quiero recibir promociones por correo cuando estén disponibles." : "Email me promotions when available."}
      </label>
      <button type="submit" disabled={busy} className={`${action} justify-self-start`}>
        {spanish ? "Guardar preferencias" : "Save preferences"}
      </button>
    </form> : null}
    <p aria-live="polite" className="mt-2 text-sm text-red-700">{failed
      ? (spanish ? "No se pudo completar la operación. Intenta de nuevo." : "We couldn't complete that. Try again.") : ""}</p>
    <p role="status" className="text-sm text-[#075a49]">{message}</p>
  </section>
}
