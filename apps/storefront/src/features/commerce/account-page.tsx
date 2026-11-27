"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

import type { Customer, CustomerAddress } from "@/lib/medusa/customer"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"
import { useToast } from "./toast-provider"
import { AccountOrders } from "./account-orders"
import { AccountLists } from "./account-lists"
import { AccountNotices } from "./account-notices"
import { jsonRequest } from "./account-request"

type AuthMode = "login" | "register"

type AuthFields = { email: string; password: string; first_name: string; last_name: string }

type AddressFields = {
  first_name: string
  last_name: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
  phone: string
}

const EMPTY_AUTH: AuthFields = { email: "", password: "", first_name: "", last_name: "" }
const EMPTY_ADDRESS: AddressFields = {
  first_name: "",
  last_name: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
  phone: "",
}

export function AccountPage({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const copy = dictionary.account
  const commerce = dictionary.commerce
  const { cart, refresh: refreshCart } = useCommerce()
  const { notify } = useToast()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<AuthMode>("login")
  const [auth, setAuth] = useState<AuthFields>(EMPTY_AUTH)
  const [address, setAddress] = useState<AddressFields>(EMPTY_ADDRESS)
  const [showAddress, setShowAddress] = useState(false)
  const [editingAddress, setEditingAddress] = useState<string | null>(null)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const spanish = locale === "es"
  const action = "inline-flex min-h-11 items-center text-xs font-bold text-[#0d3b6e] underline underline-offset-4 disabled:opacity-50"
  const panel = "scroll-mt-28 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5"

  useEffect(() => {
    void (async () => {
      try {
        const result = await jsonRequest<{ customer: Customer | null }>("/api/account")
        setCustomer(result.customer)
      } catch {
        setCustomer(null)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      const path = mode === "login" ? "/api/account" : "/api/account/register"
      const result = await jsonRequest<{ customer: Customer | null }>(path, {
        method: "POST",
        body: JSON.stringify(auth),
      })
      setCustomer(result.customer)
      setAuth(EMPTY_AUTH)
      notify({ title: commerce.sessionStarted })
      await refreshCart()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : commerce.error
      setError(message)
      notify({ title: commerce.cartError, description: message, tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  const logout = async () => {
    setBusy(true)
    try {
      await jsonRequest("/api/account", { method: "DELETE" })
      setCustomer(null)
      setAddress(EMPTY_ADDRESS)
      setShowAddress(false)
      setEditingAddress(null)
      setError("")
      setMessage("")
      setMode("login")
      notify({ title: commerce.sessionClosed, tone: "info" })
      await refreshCart()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : commerce.error)
    } finally {
      setBusy(false)
    }
  }

  const saveAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    setMessage("")
    try {
      await jsonRequest(editingAddress ? `/api/account/addresses/${encodeURIComponent(editingAddress)}` : "/api/account/addresses", {
        method: editingAddress ? "PATCH" : "POST",
        body: JSON.stringify(address),
      })
      const result = await jsonRequest<{ customer: Customer | null }>("/api/account")
      setCustomer(result.customer)
      setAddress(EMPTY_ADDRESS)
      setEditingAddress(null)
      setShowAddress(false)
      setMessage(copy.addressSaved)
      notify({ title: copy.addressSaved })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : commerce.error
      setError(message)
      notify({ title: commerce.cartError, description: message, tone: "error" })
    } finally {
      setBusy(false)
    }
  }

  function editAddress(item?: CustomerAddress) {
    setEditingAddress(item?.id ?? null)
    setAddress(item ? {
      first_name: item.first_name ?? "", last_name: item.last_name ?? "",
      address_1: item.address_1 ?? "", address_2: item.address_2 ?? "",
      city: item.city ?? "", province: item.province ?? "",
      postal_code: item.postal_code ?? "", phone: item.phone ?? "",
    } : EMPTY_ADDRESS)
    setShowAddress(true)
  }

  async function changeAddress(id: string, method: "DELETE" | "PATCH") {
    setBusy(true)
    setError("")
    try {
      await jsonRequest(`/api/account/addresses/${encodeURIComponent(id)}`, {
        method, ...(method === "PATCH" ? { body: JSON.stringify({ is_default_shipping: true }) } : {}),
      })
      const result = await jsonRequest<{ customer: Customer | null }>("/api/account")
      setCustomer(result.customer)
      if (editingAddress === id && method === "DELETE") setShowAddress(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : commerce.error)
    } finally {
      setBusy(false)
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const body = Object.fromEntries(new FormData(event.currentTarget))
    setBusy(true)
    setError("")
    try {
      const result = await jsonRequest<{ customer: Customer | null }>("/api/account", {
        method: "PATCH", body: JSON.stringify(body),
      })
      setCustomer(result.customer)
      setMessage(spanish ? "Perfil actualizado." : "Profile updated.")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : commerce.error)
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div role="status" className="mx-auto grid max-w-5xl gap-4 px-4 py-12 text-sm text-[#5b6f82]">
      {commerce.loading}<span className="h-28 rounded-2xl bg-[#0d3b6e]/5 motion-safe:animate-pulse" aria-hidden="true" />
    </div>
  }

  if (!customer) {
    return (
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-6">
          <h1 className="text-2xl font-black uppercase tracking-tight text-[#0d3b6e]">
            {mode === "login" ? copy.loginTitle : copy.registerTitle}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[#5b6f82]">
            {mode === "login" ? copy.loginLead : copy.registerLead}
          </p>
          <form onSubmit={submitAuth} className="mt-5 grid gap-3">
            {mode === "register" ? (
              <div className="grid grid-cols-2 gap-3">
                <AuthField label={copy.firstName} value={auth.first_name} onChange={(value) => setAuth((current) => ({ ...current, first_name: value }))} autoComplete="given-name" />
                <AuthField label={copy.lastName} value={auth.last_name} onChange={(value) => setAuth((current) => ({ ...current, last_name: value }))} autoComplete="family-name" />
              </div>
            ) : null}
            <AuthField label={copy.email} type="email" value={auth.email} onChange={(value) => setAuth((current) => ({ ...current, email: value }))} autoComplete="email" />
            <AuthField label={copy.password} type="password" value={auth.password} onChange={(value) => setAuth((current) => ({ ...current, password: value }))} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
            <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-[#0d3b6e] px-5 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-50">
              {busy ? commerce.processing : mode === "login" ? copy.login : copy.register}
            </button>
          </form>
          <button type="button" onClick={() => { setMode(mode === "login" ? "register" : "login"); setError("") }} className="mt-4 text-xs font-bold text-[#0d3b6e] underline underline-offset-4">
            {mode === "login" ? `${copy.noAccount} ${copy.register}` : `${copy.haveAccount} ${copy.login}`}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.65rem] font-black uppercase tracking-[0.2em] text-[#b4234a]">{copy.memberSince}</p>
          <h1 className="mt-1 text-3xl font-black uppercase tracking-tight text-[#0d3b6e]">
            {copy.title}
          </h1>
          <p className="mt-2 text-sm text-[#5b6f82]">{customer.first_name
            ? `${spanish ? "Hola" : "Hello"}, ${customer.first_name}`
            : customer.email}</p>
        </div>
        <button type="button" onClick={() => void logout()} disabled={busy} className="min-h-11 rounded-full border border-[#0d3b6e]/30 px-5 text-xs font-black uppercase tracking-[0.08em] text-[#0d3b6e] disabled:opacity-50">
          {copy.logout}
        </button>
      </header>

      {message ? <p role="status" className="mt-4 rounded-lg bg-[#eafaf6] px-3 py-2 text-xs text-[#075a49]">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[11rem_minmax(0,1fr)]">
        <nav aria-label={spanish ? "Secciones de mi cuenta" : "Account sections"}
          className="flex flex-wrap gap-x-4 lg:flex-col lg:items-start">
          <a href="#pedidos" className={action}>{copy.orders}</a>
          <a href="#listas" className={action}>{spanish ? "Mis listas" : "My lists"}</a>
          <a href="#direcciones" className={action}>{copy.addresses}</a>
          <a href="#perfil" className={action}>{spanish ? "Mi perfil" : "My profile"}</a>
          <a href="#notificaciones" className={action}>{spanish ? "Notificaciones" : "Notifications"}</a>
          <Link href={`/${locale}/carrito`} className={action}>{spanish ? "Mi carrito" : "My cart"} {cart?.itemCount ? `(${cart.itemCount})` : ""}</Link>
        </nav>
        <div className="grid min-w-0 gap-6">
        <AccountOrders locale={locale} dictionary={dictionary} key={customer.id} />
        <AccountLists locale={locale} key={`${customer.id}:lists`} />
        <section id="direcciones" className={panel}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{copy.addresses}</h2>
            <button type="button" onClick={() => editAddress()} disabled={busy} className={action}>
              {copy.addAddress}
            </button>
          </div>
          {customer.addresses.length ? (
            <ul className="mt-4 grid gap-3">
              {customer.addresses.map((item) => (
                <li key={item.id} className="rounded-xl border border-[#0d3b6e]/10 bg-white p-3 text-sm">
                  <p className="font-bold">{item.first_name} {item.last_name}</p>
                  <p className="text-[#5b6f82]">{item.address_1} {item.address_2}</p>
                  <p className="text-[#5b6f82]">{item.city}, {item.province} {item.postal_code}</p>
                  {item.is_default_shipping ? <p className="mt-2 text-xs font-bold text-[#007f7b]">
                    {spanish ? "Envío predeterminado" : "Default shipping"}
                  </p> : null}
                  <div className="flex flex-wrap gap-x-4">
                    <button type="button" disabled={busy} className={action} onClick={() => editAddress(item)}>
                      {spanish ? "Editar" : "Edit"}
                    </button>
                    {!item.is_default_shipping ? <button type="button" disabled={busy} className={action}
                      onClick={() => void changeAddress(item.id, "PATCH")}>
                      {spanish ? "Usar por defecto" : "Set as default"}
                    </button> : null}
                    <button type="button" disabled={busy} className={`${action} text-red-700`} onClick={() => {
                      if (window.confirm(spanish ? "¿Eliminar esta dirección?" : "Delete this address?")) void changeAddress(item.id, "DELETE")
                    }}>{spanish ? "Eliminar" : "Delete"}</button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#5b6f82]">{copy.noAddresses}</p>
          )}
          {showAddress ? (
            <form onSubmit={saveAddress} className="mt-4 grid gap-3 border-t border-[#0d3b6e]/10 pt-4">
              <div className="grid grid-cols-2 gap-3">
                <AuthField label={copy.firstName} value={address.first_name} onChange={(value) => setAddress((current) => ({ ...current, first_name: value }))} />
                <AuthField label={copy.lastName} value={address.last_name} onChange={(value) => setAddress((current) => ({ ...current, last_name: value }))} />
              </div>
              <AuthField label={commerce.address1} value={address.address_1} onChange={(value) => setAddress((current) => ({ ...current, address_1: value }))} />
              <AuthField label={commerce.address2} value={address.address_2} required={false} onChange={(value) => setAddress((current) => ({ ...current, address_2: value }))} />
              <AuthField label={commerce.city} value={address.city} onChange={(value) => setAddress((current) => ({ ...current, city: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <AuthField label={commerce.state} value={address.province} onChange={(value) => setAddress((current) => ({ ...current, province: value }))} />
                <AuthField label={commerce.postalCode} value={address.postal_code} onChange={(value) => setAddress((current) => ({ ...current, postal_code: value }))} />
              </div>
              <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#0d3b6e] px-4 text-xs font-black uppercase tracking-[0.08em] text-white disabled:opacity-50">
                {copy.saveAddress}
              </button>
              <button type="button" disabled={busy} className={action} onClick={() => setShowAddress(false)}>
                {spanish ? "Cancelar" : "Cancel"}
              </button>
            </form>
          ) : null}
        </section>

        <section id="perfil" className={panel}>
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{spanish ? "Mi perfil" : "My profile"}</h2>
          <p className="mt-3 break-words text-sm text-[#5b6f82]">{copy.email}: {customer.email}</p>
          <form onSubmit={saveProfile} className="mt-4 grid gap-3">
            {([
              ["first_name", copy.firstName, "given-name", "text", 80],
              ["last_name", copy.lastName, "family-name", "text", 120],
              ["phone", commerce.phone, "tel", "tel", 40],
            ] as const).map(([name, label, autoComplete, type, maxLength]) => (
              <label key={name} className="grid gap-1.5 text-xs font-bold">{label}
                <input name={name} required={name !== "phone"} maxLength={maxLength} autoComplete={autoComplete}
                  type={type} defaultValue={customer[name] ?? ""} className="min-h-11 rounded-lg border border-[#0d3b6e]/30 px-3 text-base" />
              </label>
            ))}
            <button type="submit" disabled={busy} className="min-h-12 rounded-full bg-[#0d3b6e] px-4 text-sm font-black text-white disabled:opacity-50">
              {spanish ? "Guardar perfil" : "Save profile"}
            </button>
          </form>
        </section>
        <AccountNotices locale={locale} key={`${customer.id}:notices`} />
        </div>
      </div>
    </div>
  )
}

function AuthField({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  required?: boolean
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[#202a35]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required={required}
        className="min-h-11 rounded-lg border border-[#0d3b6e]/20 bg-white px-3 text-sm outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30"
      />
    </label>
  )
}
