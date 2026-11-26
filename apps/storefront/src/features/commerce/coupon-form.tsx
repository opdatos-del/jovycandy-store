"use client"

import { useState } from "react"

import type { Dictionary } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"
import { useToast } from "./toast-provider"

type CouponFormProps = {
  dictionary: Dictionary
  compact?: boolean
}

/**
 * Aplica y retira códigos de promoción. No calcula descuentos: Medusa decide
 * elegibilidad, monto y total; aquí solo se refleja el carrito devuelto.
 */
export function CouponForm({ dictionary, compact = false }: CouponFormProps) {
  const copy = dictionary.commerce
  const { cart, mutating, applyPromotion, removePromotion } = useCommerce()
  const { notify } = useToast()
  const [code, setCode] = useState("")

  const applied = cart?.promotions ?? []

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = code.trim()
    if (!normalized || mutating) return
    try {
      await applyPromotion(normalized)
      setCode("")
      notify({ title: copy.couponApplied, description: normalized.toUpperCase() })
    } catch (reason) {
      notify({
        title: copy.couponError,
        description: reason instanceof Error ? reason.message : copy.couponErrorLead,
        tone: "error",
      })
    }
  }

  const remove = async (value: string) => {
    if (mutating) return
    try {
      await removePromotion(value)
      notify({ title: copy.couponRemoved, description: value })
    } catch (reason) {
      notify({
        title: copy.couponError,
        description: reason instanceof Error ? reason.message : copy.couponErrorLead,
        tone: "error",
      })
    }
  }

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3"}>
      <form onSubmit={submit} className="grid gap-2">
        <label className="grid gap-1.5 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#0d3b6e]">
          {copy.coupon}
          <span className="flex gap-2">
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={copy.couponPlaceholder}
              autoComplete="off"
              maxLength={64}
              className="min-h-10 min-w-0 flex-1 rounded-lg border border-[#0d3b6e]/20 bg-white px-3 text-sm font-normal normal-case tracking-normal outline-none focus:border-[#007f7b] focus:ring-2 focus:ring-[#007f7b]/30"
            />
            <button
              type="submit"
              disabled={mutating || !code.trim()}
              className="inline-flex min-h-10 shrink-0 items-center rounded-lg bg-[#0d3b6e] px-4 text-[0.65rem] font-black uppercase tracking-[0.08em] text-white disabled:opacity-50"
            >
              {copy.applyCoupon}
            </button>
          </span>
        </label>
      </form>

      {applied.length ? (
        <ul className="grid gap-1.5" aria-label={copy.coupon}>
          {applied.map((promotion) => (
            <li
              key={promotion.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-[#00afaa]/40 bg-[#eafaf6] px-3 py-2 text-xs text-[#075a49]"
            >
              <span className="font-black tracking-wide">{promotion.code}</span>
              {promotion.isAutomatic ? (
                <span className="text-[0.6rem] uppercase tracking-[0.08em]">{copy.discount}</span>
              ) : (
                <button
                  type="button"
                  disabled={mutating}
                  onClick={() => void remove(promotion.code)}
                  className="text-[0.6rem] font-bold uppercase tracking-[0.08em] underline underline-offset-2 disabled:opacity-50"
                >
                  {copy.removeCoupon}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
