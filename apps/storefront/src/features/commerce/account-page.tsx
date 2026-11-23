"use client"

import { useEffect, useState } from "react"

import { formatMoney } from "@/lib/commerce/format"
import type { Customer, CustomerOrder } from "@/lib/medusa/customer"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"
import { useToast } from "./toast-provider"

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

async function jsonRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
    cache: "no-store",
  })
  const payload = (await response.json().catch(() => null)) as (T & { message?: string }) | null
  if (!response.ok) {
    throw new Error(payload?.message ?? "No se pudo completar la operación.")
  }
  return payload as T
}

export function AccountPage({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const copy = dictionary.account
  const commerce = dictionary.commerce
  const { refresh: refreshCart } = useCommerce()
  const { notify } = useToast()
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<AuthMode>("login")
  const [auth, setAuth] = useState<AuthFields>(EMPTY_AUTH)
  const [address, setAddress] = useState<AddressFields>(EMPTY_ADDRESS)
  const [showAddress, setShowAddress] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")

  const loadOrders = async () => {
    const result = await jsonRequest<{ orders: CustomerOrder[] }>("/api/account/orders")
    setOrders(result.orders ?? [])
  }

  useEffect(() => {
    void (async () => {
      try {
        const result = await jsonRequest<{ customer: Customer | null }>("/api/account")
        setCustomer(result.customer)
        if (result.customer) await loadOrders()
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
      await Promise.all([refreshCart(), loadOrders()])
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
      setOrders([])
      setMode("login")
      notify({ title: commerce.sessionClosed, tone: "info" })
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
      await jsonRequest("/api/account/addresses", {
        method: "POST",
        body: JSON.stringify(address),
      })
      const result = await jsonRequest<{ customer: Customer | null }>("/api/account")
      setCustomer(result.customer)
      setAddress(EMPTY_ADDRESS)
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

  if (loading) {
    return <p className="px-4 py-20 text-center text-sm text-[#5b6f82]">{commerce.loading}</p>
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
          <p className="mt-2 text-sm text-[#5b6f82]">{customer.email}</p>
        </div>
        <button type="button" onClick={() => void logout()} disabled={busy} className="min-h-11 rounded-full border border-[#0d3b6e]/30 px-5 text-xs font-black uppercase tracking-[0.08em] text-[#0d3b6e] disabled:opacity-50">
          {copy.logout}
        </button>
      </header>

      {message ? <p role="status" className="mt-4 rounded-lg bg-[#eafaf6] px-3 py-2 text-xs text-[#075a49]">{message}</p> : null}
      {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p> : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{copy.addresses}</h2>
            <button type="button" onClick={() => setShowAddress((value) => !value)} className="text-[0.62rem] font-bold uppercase tracking-[0.08em] text-[#0d3b6e] underline underline-offset-4">
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
              <AuthField label={commerce.city} value={address.city} onChange={(value) => setAddress((current) => ({ ...current, city: value }))} />
              <div className="grid grid-cols-2 gap-3">
                <AuthField label={commerce.state} value={address.province} onChange={(value) => setAddress((current) => ({ ...current, province: value }))} />
                <AuthField label={commerce.postalCode} value={address.postal_code} onChange={(value) => setAddress((current) => ({ ...current, postal_code: value }))} />
              </div>
              <button type="submit" disabled={busy} className="min-h-11 rounded-full bg-[#0d3b6e] px-4 text-xs font-black uppercase tracking-[0.08em] text-white disabled:opacity-50">
                {copy.saveAddress}
              </button>
            </form>
          ) : null}
        </section>

        <section className="rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">{copy.orders}</h2>
          {orders.length ? (
            <ul className="mt-4 grid gap-3">
              {orders.map((order) => (
                <li key={order.id} className="rounded-xl border border-[#0d3b6e]/10 bg-white p-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="font-bold">#{order.displayId ?? order.id}</span>
                    <span className="font-black">{formatMoney(order.total, order.currencyCode, locale)}</span>
                  </div>
                  <p className="mt-1 text-xs text-[#5b6f82]">{order.status}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-[#5b6f82]">{copy.noOrders}</p>
          )}
        </section>
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
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-[#202a35]">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        required
        className="min-h-11 rounded-lg border border-[#0d3b6e]/20 bg-white px-3 text-sm outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30"
      />
    </label>
  )
}
