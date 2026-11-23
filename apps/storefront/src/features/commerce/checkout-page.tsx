"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { formatMoney } from "@/lib/commerce/format"
import type { Dictionary, Locale } from "@/lib/i18n"
import type { ShippingOption } from "@/lib/medusa/store"

import { useCommerce } from "./cart-provider"
import { useToast } from "./toast-provider"

type Step = "address" | "shipping" | "payment" | "review"

type AddressFields = {
  email: string
  first_name: string
  last_name: string
  phone: string
  address_1: string
  address_2: string
  city: string
  province: string
  postal_code: string
}

const EMPTY_ADDRESS: AddressFields = {
  email: "",
  first_name: "",
  last_name: "",
  phone: "",
  address_1: "",
  address_2: "",
  city: "",
  province: "",
  postal_code: "",
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => null)) as { message?: string } | null
  if (!response.ok) throw new Error(payload?.message ?? "No se pudo completar la operación.")
  return payload
}

export function CheckoutPage({ locale, dictionary }: { locale: Locale; dictionary: Dictionary }) {
  const copy = dictionary.commerce
  const router = useRouter()
  const { cart, loading, refresh } = useCommerce()
  const { notify } = useToast()
  const [step, setStep] = useState<Step>("address")
  const [address, setAddress] = useState<AddressFields>(EMPTY_ADDRESS)
  const [options, setOptions] = useState<ShippingOption[]>([])
  const [selectedOption, setSelectedOption] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (loading && !cart) {
    return <p className="px-4 py-20 text-center text-sm text-[#5b6f82]">{copy.loading}</p>
  }
  if (!cart || !cart.items.length) {
    return (
      <div className="mx-auto grid max-w-xl place-items-center gap-5 px-4 py-24 text-center">
        <h1 className="text-3xl font-black uppercase tracking-tight text-[#0d3b6e]">
          {copy.emptyCheckout}
        </h1>
        <Link
          href={`/${locale}/catalogo`}
          className="inline-flex min-h-12 items-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white"
        >
          {copy.continueShopping}
        </Link>
      </div>
    )
  }

  const updateAddress = (field: keyof AddressFields, value: string) =>
    setAddress((current) => ({ ...current, [field]: value }))

  const submitAddress = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError("")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email)) {
      setError(copy.invalidEmail)
      return
    }
    if (!/^\d{5}$/.test(address.postal_code)) {
      setError(copy.invalidPostal)
      return
    }
    const required = [
      address.first_name,
      address.last_name,
      address.address_1,
      address.city,
      address.province,
    ]
    if (required.some((value) => !value.trim())) {
      setError(copy.required)
      return
    }

    setBusy(true)
    try {
      await postJson("/api/checkout/address", { ...address, country_code: "mx" })
      const response = await fetch("/api/checkout/shipping-options", { cache: "no-store" })
      const payload = (await response.json()) as { options?: ShippingOption[]; message?: string }
      if (!response.ok) throw new Error(payload.message ?? copy.error)
      setOptions(payload.options ?? [])
      await refresh()
      setStep("shipping")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error)
    } finally {
      setBusy(false)
    }
  }

  const submitShipping = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedOption) return
    setBusy(true)
    setError("")
    try {
      await postJson("/api/checkout/shipping-method", { option_id: selectedOption })
      await refresh()
      setStep("payment")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error)
    } finally {
      setBusy(false)
    }
  }

  const preparePayment = async () => {
    setBusy(true)
    setError("")
    try {
      await postJson("/api/checkout/payment", {})
      await refresh()
      setStep("review")
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error)
    } finally {
      setBusy(false)
    }
  }

  const placeOrder = async () => {
    setBusy(true)
    setError("")
    try {
      const result = (await postJson("/api/checkout/complete", {})) as { order?: { id: string } }
      if (!result.order?.id) throw new Error(copy.error)
      notify({ title: copy.orderPlaced, description: copy.orderPlacedLead });
      router.push(`/${locale}/checkout/confirmacion`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : copy.error)
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.24em] text-[#b4234a]">
          JovyCandy · {copy.checkoutTitle}
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-[#0d3b6e]">
          {copy.checkoutTitle}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5b6f82]">{copy.checkoutLead}</p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
        <div className="grid gap-5">
          <ol className="flex flex-wrap gap-2 text-[0.62rem] font-black uppercase tracking-[0.1em] text-[#5b6f82]">
            {[
              ["address", copy.contactData],
              ["shipping", copy.shippingMethod],
              ["payment", copy.paymentMethod],
              ["review", copy.reviewOrder],
            ].map(([key, label], index) => (
              <li
                key={key}
                aria-current={step === key ? "step" : undefined}
                className={`rounded-full border px-3 py-2 ${
                  step === key
                    ? "border-[#0d3b6e] bg-[#0d3b6e] text-white"
                    : "border-[#0d3b6e]/20 bg-white"
                }`}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>

          {step === "address" ? (
            <form onSubmit={submitAddress} className="jovy-animate-in grid gap-4 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
                {copy.contactData}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={copy.email} type="email" autoComplete="email" value={address.email} onChange={(value) => updateAddress("email", value)} />
                <Field label={copy.phone} type="tel" autoComplete="tel" value={address.phone} onChange={(value) => updateAddress("phone", value)} />
                <Field label={copy.firstName} autoComplete="given-name" value={address.first_name} onChange={(value) => updateAddress("first_name", value)} />
                <Field label={copy.lastName} autoComplete="family-name" value={address.last_name} onChange={(value) => updateAddress("last_name", value)} />
              </div>
              <h2 className="mt-2 text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
                {copy.shippingAddress}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Field label={copy.address1} autoComplete="address-line1" value={address.address_1} onChange={(value) => updateAddress("address_1", value)} />
                </div>
                <div className="sm:col-span-2">
                  <Field label={copy.address2} autoComplete="address-line2" value={address.address_2} onChange={(value) => updateAddress("address_2", value)} required={false} />
                </div>
                <Field label={copy.city} autoComplete="address-level2" value={address.city} onChange={(value) => updateAddress("city", value)} />
                <Field label={copy.state} autoComplete="address-level1" value={address.province} onChange={(value) => updateAddress("province", value)} />
                <Field label={copy.postalCode} autoComplete="postal-code" inputMode="numeric" maxLength={5} value={address.postal_code} onChange={(value) => updateAddress("postal_code", value)} />
                <label className="grid gap-1.5 text-xs font-bold text-[#202a35]">
                  {copy.country}
                  <input value="México" readOnly className="min-h-11 rounded-lg border border-[#0d3b6e]/20 bg-[#eef4f8] px-3 text-sm" />
                </label>
              </div>
              {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
              <button
                type="submit"
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-50"
              >
                {busy ? copy.processing : copy.continueToShipping}
              </button>
            </form>
          ) : null}

          {step === "shipping" ? (
            <form onSubmit={submitShipping} className="jovy-animate-in grid gap-4 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
                {copy.shippingMethod}
              </h2>
              {options.length ? (
                <div className="grid gap-3">
                  {options.map((option) => (
                    <label
                      key={option.id}
                      className={`flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-xl border p-4 ${
                        selectedOption === option.id
                          ? "border-[#0d3b6e] bg-white shadow-sm"
                          : "border-[#0d3b6e]/15 bg-white/60"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shipping-option"
                          value={option.id}
                          checked={selectedOption === option.id}
                          onChange={() => setSelectedOption(option.id)}
                        />
                        <span className="text-sm font-bold">{option.name}</span>
                      </span>
                      <span className="text-sm font-black">
                        {formatMoney(option.amount, option.currencyCode, locale)}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#5b6f82]">{copy.noShipping}</p>
              )}
              {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setStep("address")} className="inline-flex min-h-11 items-center px-2 text-xs font-bold uppercase tracking-[0.08em] text-[#0d3b6e] underline underline-offset-4">
                  {copy.contactData}
                </button>
                <button
                  type="submit"
                  disabled={busy || !selectedOption}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-50"
                >
                  {busy ? copy.processing : copy.continueToPayment}
                </button>
              </div>
            </form>
          ) : null}

          {step === "payment" ? (
            <section className="jovy-animate-in grid gap-4 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
                {copy.paymentMethod}
              </h2>
              <div className="rounded-xl border border-[#00afaa]/40 bg-[#eafaf6] p-4">
                <p className="text-sm font-black text-[#075a49]">{copy.paymentDemo}</p>
                <p className="mt-1 text-xs leading-5 text-[#075a49]">{copy.paymentDemoNote}</p>
              </div>
              {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
              <button
                type="button"
                onClick={() => void preparePayment()}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-50"
              >
                {busy ? copy.processing : copy.reviewOrder}
              </button>
            </section>
          ) : null}

          {step === "review" ? (
            <section className="jovy-animate-in grid gap-4 rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
              <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
                {copy.reviewOrder}
              </h2>
              <div className="grid gap-3">
                {cart.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4 border-b border-[#0d3b6e]/10 pb-3 text-sm">
                    <span>
                      {item.quantity} × {item.productTitle}
                      {item.variantTitle ? <span className="block text-xs text-[#5b6f82]">{item.variantTitle}</span> : null}
                    </span>
                    <span className="shrink-0 font-black">{formatMoney(item.total, cart.currencyCode, locale)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-[#00afaa]/40 bg-[#eafaf6] p-4 text-xs leading-5 text-[#075a49]">
                <p className="font-black">{copy.paymentDemo}</p>
                <p>{copy.paymentDemoNote}</p>
              </div>
              {error ? <p role="alert" className="text-xs text-red-700">{error}</p> : null}
              <button
                type="button"
                onClick={() => void placeOrder()}
                disabled={busy}
                className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#0d3b6e] px-6 text-xs font-black uppercase tracking-[0.1em] text-white disabled:opacity-50"
              >
                {busy ? copy.processing : copy.placeOrder}
              </button>
            </section>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-[#0d3b6e]/15 bg-[#fffdf7] p-5">
          <h2 className="text-sm font-black uppercase tracking-[0.12em] text-[#0d3b6e]">
            {copy.orderSummary}
          </h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <div className="flex justify-between gap-4 text-[#5b6f82]">
              <dt>{copy.subtotal}</dt>
              <dd>{formatMoney(cart.subtotal, cart.currencyCode, locale)}</dd>
            </div>
            {cart.shippingTotal > 0 ? (
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
          <p className="mt-3 text-[0.66rem] leading-5 text-[#5b6f82]">{copy.demoNote}</p>
        </aside>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  inputMode,
  maxLength,
  required = true,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
  autoComplete?: string
  inputMode?: "numeric" | "tel" | "email"
  maxLength?: number
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
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        className="min-h-11 rounded-lg border border-[#0d3b6e]/20 bg-white px-3 text-sm outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30"
      />
    </label>
  )
}
