"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"

import type { Locale } from "@/lib/i18n"
import type { CustomerList } from "@/lib/medusa/customer"

import { jsonRequest } from "./account-request"
import { useCommerce } from "./cart-provider"

const action = "inline-flex min-h-11 items-center text-xs font-bold text-[#0d3b6e] underline underline-offset-4 disabled:opacity-50"
const field = "min-h-11 min-w-0 rounded-lg border border-[#0d3b6e]/30 bg-white px-3 text-base"

export function AccountLists({ locale }: { locale: Locale }) {
  const spanish = locale === "es"
  const [lists, setLists] = useState<CustomerList[]>()
  const [editing, setEditing] = useState<string>()
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const { refresh } = useCommerce()

  useEffect(() => {
    const controller = new AbortController()
    void jsonRequest<{ lists: CustomerList[] }>("/api/account/lists", { signal: controller.signal })
      .then(({ lists }) => { if (!controller.signal.aborted) setLists(lists) })
      .catch(() => {
        if (!controller.signal.aborted) setError(spanish ? "No se pudieron cargar tus listas." : "We couldn't load your lists.")
      })
    return () => controller.abort()
  }, [spanish])

  async function mutate(input: Record<string, string>) {
    if (inFlight.current) return false
    inFlight.current = true
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const { removed } = await jsonRequest<{ removed?: boolean }>("/api/account/lists", {
        method: "POST", body: JSON.stringify(input),
      })
      if (input.action === "move") {
        await refresh()
        setMessage(removed
          ? (spanish ? "Presentación movida al carrito." : "Variant moved to your cart.")
          : (spanish ? "Presentación agregada al carrito; aún está en tu lista." : "Variant added to your cart; it is still on your list."))
      }
      setLists((await jsonRequest<{ lists: CustomerList[] }>("/api/account/lists")).lists)
      setEditing(undefined)
      return true
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (spanish ? "No se pudo guardar." : "Could not save."))
      return false
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return <section id="listas" className="scroll-mt-28 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
    <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{spanish ? "Mis listas" : "My lists"}</h2>
    {!lists && !error ? <p role="status" className="mt-3 text-sm text-[#5b6f82]">{spanish ? "Cargando…" : "Loading…"}</p> : null}
    {lists ? <form className="mt-4 grid gap-2" aria-label={spanish ? "Crear lista" : "Create list"}
      onSubmit={(event) => {
        event.preventDefault()
        const form = event.currentTarget
        const name = String(new FormData(form).get("name"))
        void mutate({ action: "create", name }).then((ok) => { if (ok) form.reset() })
      }}>
      <label className="grid gap-1 text-xs font-bold text-[#0d3b6e]">
        {spanish ? "Nombre de la nueva lista" : "New list name"}
        <input name="name" className={field} required maxLength={80} />
      </label>
      <button type="submit" disabled={busy} className={`${action} justify-self-start`}>{spanish ? "Crear lista" : "Create list"}</button>
    </form> : null}
    <ul className="mt-4 grid gap-3">
      {lists?.map((list) => <li key={list.id} className="min-w-0 rounded-xl border border-[#0d3b6e]/10 bg-white p-3 text-sm">
        <h3 className="break-words font-bold text-[#0d3b6e]">{list.name ?? (spanish ? "Mis favoritos" : "My favorites")}</h3>
        {list.name ? <div className="flex flex-wrap gap-x-4">
          <button type="button" disabled={busy} className={action} onClick={() => setEditing(list.id)}>
            {spanish ? "Renombrar" : "Rename"}
          </button>
          <button type="button" disabled={busy} className={`${action} text-red-700`} onClick={() => {
            if (window.confirm(spanish ? "¿Eliminar esta lista?" : "Delete this list?")) void mutate({ action: "delete", list_id: list.id })
          }}>{spanish ? "Eliminar lista" : "Delete list"}</button>
        </div> : null}
        {editing === list.id ? <form className="grid gap-2" onSubmit={(event) => {
          event.preventDefault()
          void mutate({ action: "rename", list_id: list.id, name: String(new FormData(event.currentTarget).get("name")) })
        }}>
          <label className="grid gap-1 text-xs font-bold">{spanish ? "Nuevo nombre" : "New name"}
            <input name="name" className={field} defaultValue={list.name ?? ""} required maxLength={80} />
          </label>
          <div className="flex gap-4">
            <button type="submit" disabled={busy} className={action}>{spanish ? "Guardar" : "Save"}</button>
            <button type="button" className={action} onClick={() => setEditing(undefined)}>{spanish ? "Cancelar" : "Cancel"}</button>
          </div>
        </form> : null}
        {list.items.length ? <ul className="mt-2 grid gap-2">
          {list.items.map(({ id, variant }) => <li key={id} className="border-t border-[#0d3b6e]/10 pt-2">
            {variant ? <Link href={`/${locale}/productos/${encodeURIComponent(variant.product.handle)}`} className="break-words text-[#0d3b6e] underline">
              {variant.product.title} · {variant.title}
            </Link> : <p className="text-[#5b6f82]">{spanish ? "Presentación no disponible" : "Variant unavailable"}</p>}
            <div className="flex flex-wrap gap-x-4">
              {variant ? <button type="button" disabled={busy} className={action} onClick={() => void mutate({ action: "move", list_id: list.id, item_id: id })}>
                {spanish ? "Mover al carrito" : "Move to cart"}
              </button> : null}
              <button type="button" disabled={busy} className={action} onClick={() => void mutate({ action: "remove", list_id: list.id, item_id: id })}>
                {spanish ? "Quitar de la lista" : "Remove from list"}
              </button>
            </div>
          </li>)}
        </ul> : <Link href={`/${locale}/catalogo`} className={action}>{spanish ? "Explorar catálogo" : "Explore the catalog"}</Link>}
      </li>)}
    </ul>
    <p aria-live="polite" className="text-sm text-red-700">{error}</p>
    <p role="status" className="text-sm text-[#075a49]">{message}</p>
  </section>
}
