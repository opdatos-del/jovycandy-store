"use client"

import Link from "next/link"
import { useState } from "react"

import type { Locale } from "@/lib/i18n"
import type { CustomerList } from "@/lib/medusa/customer"

import { jsonRequest } from "./account-request"

export function SaveToList({ locale, variantId }: { locale: Locale; variantId: string }) {
  const [lists, setLists] = useState<CustomerList[]>()
  const [guest, setGuest] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const spanish = locale === "es"

  return <details onToggle={(event) => {
    if (!event.currentTarget.open || lists || busy) return
    setGuest(false)
    setBusy(true)
    setMessage("")
    void fetch("/api/account/lists", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) return setGuest(true)
      if (!response.ok) throw new Error()
      setLists((await response.json()).lists)
    }).catch(() => setMessage(spanish ? "No se pudieron cargar tus listas." : "We couldn't load your lists."))
      .finally(() => setBusy(false))
  }}>
    <summary className="min-h-11 cursor-pointer py-3 text-sm font-bold text-[#0d3b6e] underline">
      {spanish ? "Guardar en una lista" : "Save to a list"}
    </summary>
    {guest ? <Link href={`/${locale}/cuenta`} className="text-sm text-[#0d3b6e] underline">
      {spanish ? "Inicia sesión para guardar esta presentación" : "Sign in to save this variant"}
    </Link> : null}
    {lists ? <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => {
      event.preventDefault()
      if (busy) return
      setBusy(true)
      setMessage("")
      const listId = new FormData(event.currentTarget).get("list")
      void jsonRequest("/api/account/lists", {
        method: "POST", body: JSON.stringify({ action: "add", list_id: listId, variant_id: variantId }),
      }).then(() => setMessage(spanish ? "Presentación guardada." : "Variant saved."))
        .catch(() => setMessage(spanish ? "No se pudo guardar la presentación." : "We couldn't save this variant."))
        .finally(() => setBusy(false))
    }}>
      <label className="grid gap-1 text-xs font-bold text-[#0d3b6e]">{spanish ? "Lista" : "List"}
        <select name="list" className="min-h-11 max-w-52 rounded-lg border border-[#0d3b6e]/30 bg-white px-2 text-base">
          {lists.map((list) => <option key={list.id} value={list.id}>{list.name ?? (spanish ? "Mis favoritos" : "My favorites")}</option>)}
        </select>
      </label>
      <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#0d3b6e] px-4 text-sm font-bold text-white disabled:opacity-50">
        {spanish ? "Guardar" : "Save"}
      </button>
    </form> : null}
    <p role="status" className="text-sm text-[#5b6f82]">{busy ? (spanish ? "Cargando…" : "Loading…") : message}</p>
  </details>
}
