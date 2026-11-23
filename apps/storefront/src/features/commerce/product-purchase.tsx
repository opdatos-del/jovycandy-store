"use client"

import { useState } from "react"

import { ContactTrigger } from "@/components/contact-trigger"
import { formatMoney } from "@/lib/commerce/format"
import type { CommerceProduct } from "@/lib/medusa/store"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"

type ProductPurchaseProps = {
  locale: Locale
  dictionary: Dictionary
  commerce: CommerceProduct | null
  catalogOnly: boolean
}

export function ProductPurchase({
  locale,
  dictionary,
  commerce,
  catalogOnly,
}: ProductPurchaseProps) {
  const copy = dictionary.commerce
  const { addItem, setOpen, mutating } = useCommerce()
  const variants = commerce?.variants ?? []
  const firstAvailable = variants.find((variant) => variant.price !== null) ?? variants[0]
  const [variantId, setVariantId] = useState(firstAvailable?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [status, setStatus] = useState<"idle" | "adding" | "added" | "error">("idle")
  const [message, setMessage] = useState("")

  const variant = variants.find((item) => item.id === variantId) ?? firstAvailable
  const price = variant?.price ?? null
  const currency = variant?.currencyCode ?? "mxn"
  const hasStock =
    !variant ||
    !variant.manageInventory ||
    variant.allowBackorder ||
    (variant.inventoryQuantity ?? 0) > 0
  const canBuy = Boolean(commerce && variant && price !== null && hasStock && !catalogOnly)

  const add = async () => {
    if (!variant || !canBuy) return
    setStatus("adding")
    setMessage("")
    try {
      await addItem(variant.id, quantity)
      setStatus("added")
      setMessage(copy.added)
      setOpen(true)
    } catch (error) {
      setStatus("error")
      setMessage(error instanceof Error ? error.message : copy.error)
    }
  }

  return (
    <div className="product-buy">
      {variants.length ? (
        <fieldset className="product-variants">
          <legend>{copy.selectPresentation}</legend>
          <div className="product-variants__options">
            {variants.map((item) => {
              const unavailable = item.price === null
              return (
                <label
                  key={item.id}
                  className={item.id === variant?.id ? "is-selected" : ""}
                  aria-disabled={unavailable}
                >
                  <input
                    type="radio"
                    name="product-variant"
                    value={item.id}
                    checked={item.id === variant?.id}
                    disabled={unavailable}
                    onChange={() => {
                      setVariantId(item.id)
                      setStatus("idle")
                      setMessage("")
                    }}
                  />
                  <span>{item.title}</span>
                  <small>{formatMoney(item.price, item.currencyCode, locale)}</small>
                </label>
              )
            })}
          </div>
        </fieldset>
      ) : null}

      <div className="product-buy__price">
        <span>{formatMoney(price, currency, locale)}</span>
        <span className={`product-buy__availability ${hasStock ? "" : "is-unavailable"}`}>
          {hasStock ? copy.available : copy.unavailable}
        </span>
      </div>

      {catalogOnly ? (
        <>
          <ContactTrigger className="catalog-primary-button product-buy__primary">
            {dictionary.catalog.contactToBuy}
          </ContactTrigger>
          <p className="product-buy__note">{dictionary.catalog.catalogOnlyNote}</p>
        </>
      ) : (
        <>
          <div className="product-buy__row">
            <div className="product-quantity" aria-label={copy.quantity}>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label={copy.decrease}
              >
                −
              </button>
              <output>{quantity}</output>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(99, value + 1))}
                disabled={quantity >= 99}
                aria-label={copy.increase}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => void add()}
              disabled={!canBuy || mutating || status === "adding"}
              className="catalog-primary-button product-buy__primary"
            >
              {status === "adding" ? copy.adding : copy.addToCart}
            </button>
          </div>
          <p className="product-buy__note">
            {commerce ? copy.demoNote : copy.priceUnavailable}
          </p>
        </>
      )}

      <p className="product-buy__message" role="status" aria-live="polite">
        {message}
      </p>

      <ContactTrigger className="catalog-secondary-button product-buy__secondary">
        {dictionary.catalog.askQuestion}
      </ContactTrigger>
    </div>
  )
}
