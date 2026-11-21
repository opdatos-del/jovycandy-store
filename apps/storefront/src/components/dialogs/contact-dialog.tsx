"use client"

import { useEffect, useRef, useState } from "react"

import { ArrowRightIcon, CloseIcon } from "@/components/icons"
import type { Dictionary, Locale } from "@/lib/i18n"

type ContactDialogProps = {
  locale: Locale
  dictionary: Dictionary
}

type TopicKey = "nationalSales" | "internationalSales" | "customerService" | "catalogue"
type ContactType = "national-sales" | "international-sales" | "customer-service" | "catalogue"

const TOPICS: Array<{ type: ContactType; key: TopicKey; accent: string }> = [
  { type: "national-sales", key: "nationalSales", accent: "from-[#ff9076] to-[#ff5f9a]" },
  { type: "international-sales", key: "internationalSales", accent: "from-[#00bdb8] to-[#4c8fff]" },
  { type: "customer-service", key: "customerService", accent: "from-[#ffb25e] to-[#ff7a7a]" },
  { type: "catalogue", key: "catalogue", accent: "from-[#ff5f9a] to-[#ff8f63]" },
]

type FormState = {
  first_name: string
  last_name: string
  email: string
  phone: string
  country: string
  city: string
  postal_code: string
  message: string
  website: string
}

const EMPTY_FORM: FormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  country: "",
  city: "",
  postal_code: "",
  message: "",
  website: "",
}

export function ContactDialog({ dictionary }: ContactDialogProps) {
  const [open, setOpen] = useState(false)
  const [topic, setTopic] = useState<ContactType>("national-sales")
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [error, setError] = useState("")
  const firstField = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = "contact-dialog-title"

  useEffect(() => {
    const onOpen = () => {
      setOpen(true)
      setStatus("idle")
      setError("")
    }
    window.addEventListener("jovy:contact:open", onOpen)
    return () => window.removeEventListener("jovy:contact:open", onOpen)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      firstField.current?.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  const activeTopic = TOPICS.find((item) => item.type === topic) ?? TOPICS[0]
  const copy = dictionary.contact.topics[activeTopic.key]

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus("submitting")
    setError("")

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, contact_type: topic }),
      })
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null
        throw new Error(payload?.message ?? dictionary.contact.error.generic)
      }
      setStatus("success")
      setForm(EMPTY_FORM)
    } catch (reason) {
      setStatus("error")
      setError(reason instanceof Error ? reason.message : dictionary.contact.error.generic)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
      className="m-auto max-h-[92dvh] w-[min(96vw,56rem)] overflow-y-auto rounded-2xl bg-[#fffaf0] p-0 shadow-2xl backdrop:bg-stone-950/55 backdrop:backdrop-blur-sm"
    >
      <section>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stone-200/70 bg-[#fffaf0]/95 px-5 py-4 backdrop-blur">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-stone-500">{dictionary.contact.subtitle}</p>
            <h2 id={titleId} className="text-2xl font-semibold text-stone-900">{dictionary.contact.title}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={dictionary.promoBanner.close} className="rounded-full p-2 text-stone-600 transition hover:bg-stone-200">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {status === "success" ? (
          <div className="px-6 py-12 text-center sm:px-10">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-[#00afaa]">{copy.eyebrow}</p>
            <h3 className="mt-3 text-2xl font-semibold text-stone-900">{dictionary.contact.success.title}</h3>
            <p className="mx-auto mt-3 max-w-lg text-stone-600">{copy.successDetail}</p>
            <button type="button" onClick={() => setOpen(false)} className="mt-8 rounded-full bg-[#0d3b6e] px-7 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white">
              {dictionary.contact.success.close}
            </button>
          </div>
        ) : (
          <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
            <aside className="border-b border-stone-200 bg-stone-100/70 p-5 lg:border-b-0 lg:border-r">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-stone-500">{dictionary.contact.selectChannel}</p>
              <h3 className="mt-2 text-lg font-semibold text-stone-900">{dictionary.contact.whichQuery}</h3>
              <p className="mt-1 text-sm leading-6 text-stone-600">{dictionary.contact.chooseTheme}</p>
              <div className="mt-5 grid gap-2">
                {TOPICS.map((item) => {
                  const itemCopy = dictionary.contact.topics[item.key]
                  const selected = item.type === topic
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setTopic(item.type)}
                      aria-pressed={selected}
                      className={`rounded-xl border p-3 text-left transition ${selected ? "border-[#0d3b6e] bg-white shadow-sm" : "border-transparent bg-white/55 hover:bg-white"}`}
                    >
                      <span className={`mb-2 block h-1.5 w-10 rounded-full bg-gradient-to-r ${item.accent}`} />
                      <span className="block text-sm font-semibold text-stone-900">{itemCopy.label}</span>
                      <span className="mt-1 block text-xs leading-5 text-stone-500">{itemCopy.description}</span>
                    </button>
                  )
                })}
              </div>
            </aside>

            <form onSubmit={submit} className="p-5 sm:p-7" noValidate>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[#b4234a]">{copy.eyebrow}</p>
              <h3 className="mt-1 text-2xl font-semibold text-stone-900">{copy.title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{copy.description}</p>

              <input type="text" name="website" value={form.website} onChange={(event) => update("website", event.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true" className="pointer-events-none absolute h-0 w-0 opacity-0" />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label htmlFor="contact-first-name" className="grid gap-1.5 text-sm font-medium text-stone-700">
                  {dictionary.contact.fields.firstName}
                  <input id="contact-first-name" name="first_name" autoComplete="given-name" ref={firstField} required value={form.first_name} onChange={(event) => update("first_name", event.target.value)} placeholder={dictionary.contact.fields.firstNamePlaceholder} aria-invalid={status === "error" || undefined} aria-describedby={error ? "contact-form-error" : undefined} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-last-name" className="grid gap-1.5 text-sm font-medium text-stone-700">
                  {dictionary.contact.fields.lastName}
                  <input id="contact-last-name" name="last_name" autoComplete="family-name" value={form.last_name} onChange={(event) => update("last_name", event.target.value)} placeholder={dictionary.contact.fields.lastNamePlaceholder} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-email" className="grid gap-1.5 text-sm font-medium text-stone-700 sm:col-span-2">
                  {dictionary.contact.fields.email}
                  <input id="contact-email" name="email" type="email" autoComplete="email" required value={form.email} onChange={(event) => update("email", event.target.value)} placeholder={dictionary.contact.fields.emailPlaceholder} aria-invalid={status === "error" || undefined} aria-describedby={error ? "contact-form-error" : undefined} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-phone" className="grid gap-1.5 text-sm font-medium text-stone-700">
                  {dictionary.contact.fields.phone}
                  <input id="contact-phone" name="phone" type="tel" autoComplete="tel" required value={form.phone} onChange={(event) => update("phone", event.target.value)} placeholder={dictionary.contact.fields.phonePlaceholder} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-country" className="grid gap-1.5 text-sm font-medium text-stone-700">
                  {dictionary.contact.fields.country}
                  <input id="contact-country" name="country" autoComplete="country-name" value={form.country} onChange={(event) => update("country", event.target.value)} placeholder={dictionary.contact.fields.countryPlaceholder} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-city" className="grid gap-1.5 text-sm font-medium text-stone-700">
                  {dictionary.contact.fields.city}
                  <input id="contact-city" name="city" autoComplete="address-level2" value={form.city} onChange={(event) => update("city", event.target.value)} placeholder={dictionary.contact.fields.cityPlaceholder} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-postal-code" className="grid gap-1.5 text-sm font-medium text-stone-700">
                  {dictionary.contact.fields.postalCode}
                  <input id="contact-postal-code" name="postal_code" autoComplete="postal-code" value={form.postal_code} onChange={(event) => update("postal_code", event.target.value)} placeholder={dictionary.contact.fields.postalCodePlaceholder} className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
                <label htmlFor="contact-message" className="grid gap-1.5 text-sm font-medium text-stone-700 sm:col-span-2">
                  {dictionary.contact.fields.message}
                  <textarea id="contact-message" name="message" required rows={6} value={form.message} onChange={(event) => update("message", event.target.value)} placeholder={copy.messagePlaceholder} aria-invalid={status === "error" || undefined} aria-describedby={error ? "contact-form-error" : undefined} className="resize-y rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-stone-900 outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30" />
                </label>
              </div>

              {error ? <p id="contact-form-error" role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

              <div className="mt-5 flex flex-col gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-stone-500">{dictionary.contact.submitNote}</p>
                <button type="submit" disabled={status === "submitting"} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#0d3b6e] px-6 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition hover:bg-[#0a2c52] disabled:opacity-60">
                  {status === "submitting" ? dictionary.contact.submitting : copy.submitLabel}
                  <ArrowRightIcon className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </section>
    </dialog>
  )
}

