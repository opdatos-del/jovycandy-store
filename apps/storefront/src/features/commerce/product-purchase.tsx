"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { ContactTrigger } from "@/components/contact-trigger"
import { formatMoney } from "@/lib/commerce/format"
import { sortByWeight, weightLabel } from "@/lib/commerce/weight"
import type { CommerceProduct, CommerceVariant } from "@/lib/medusa/store"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"
import { useToast } from "./toast-provider"

type ProductPurchaseProps = {
  locale: Locale
  dictionary: Dictionary
  commerce: CommerceProduct | null
  catalogOnly: boolean
  productTitle: string
  fallbackWeight?: string | null
}

function isVariantAvailable(variant: CommerceVariant | undefined) {
  if (!variant) return false
  if (variant.price === null) return false
  if (!variant.manageInventory || variant.allowBackorder) return true
  return (variant.inventoryQuantity ?? 0) > 0
}

export function ProductPurchase({
  locale,
  dictionary,
  commerce,
  catalogOnly,
  productTitle,
  fallbackWeight,
}: ProductPurchaseProps) {
  const copy = dictionary.commerce
  const { addItem, setOpen, mutating } = useCommerce()
  const { notify } = useToast()
  const rootRef = useRef<HTMLDivElement>(null)
  const [stickyVisible, setStickyVisible] = useState(false)

  const variants = useMemo(
    () => sortByWeight(commerce?.variants ?? []).filter((variant) => variant.price !== null),
    [commerce],
  )
  const [variantId, setVariantId] = useState<string>(variants[0]?.id ?? "")
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const variant = variants.find((item) => item.id === variantId) ?? variants[0]
  const price = variant?.price ?? null
  const currency = variant?.currencyCode ?? "mxn"
  const canBuy = Boolean(commerce && variant && isVariantAvailable(variant) && !catalogOnly)

  useEffect(() => {
    const node = rootRef.current
    if (!node || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      ([entry]) => setStickyVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0),
      { rootMargin: "-80px 0px 0px 0px", threshold: 0 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  const add = async () => {
    if (!variant || !canBuy || adding) return
    setAdding(true)
    try {
      await addItem(variant.id, quantity)
      notify({
        title: copy.addedToCart,
        description: `${productTitle} · ${weightLabel(variant.title) ?? variant.title}`,
      })
      setJustAdded(true)
      setTimeout(() => setJustAdded(false), 1600)
    } catch (reason) {
      notify({
        title: copy.cartError,
        description: reason instanceof Error ? reason.message : copy.cartErrorLead,
        tone: "error",
      })
    } finally {
      setAdding(false)
    }
  }

  const availability = !variant
    ? copy.unavailable
    : isVariantAvailable(variant)
      ? copy.available
      : copy.itemUnavailable

  return (
    <div className="product-buy" ref={rootRef}>
      {catalogOnly ? (
        <>
          <ContactTrigger className="catalog-primary-button product-buy__primary">
            {dictionary.catalog.contactToBuy}
          </ContactTrigger>
          <p className="product-buy__note">{dictionary.catalog.catalogOnlyNote}</p>
        </>
      ) : (
        <>
          {variants.length > 1 ? (
            <fieldset className="product-variants">
              <legend>{copy.presentation}</legend>
              <div className="product-variants__options" role="radiogroup" aria-label={copy.presentation}>
                {variants.map((item) => {
                  const selected = item.id === variant?.id
                  return (
                    <label key={item.id} className={selected ? "is-selected" : ""}>
                      <input
                        type="radio"
                        name="product-variant"
                        value={item.id}
                        checked={selected}
                        onChange={() => {
                          setVariantId(item.id)
                          setQuantity(1)
                        }}
                      />
                      <span>{weightLabel(item.title) ?? item.title}</span>
                      <small>{formatMoney(item.price, item.currencyCode ?? currency, locale)}</small>
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="product-buy__price">
            <div>
              <span key={variant?.id} className="product-buy__amount jovy-pop">
                {formatMoney(price, currency, locale)}
              </span>
            </div>
            <span className={`product-buy__availability ${variant && isVariantAvailable(variant) ? "" : "is-unavailable"}`}>
              {availability}
            </span>
          </div>

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
              <output aria-live="polite">{quantity}</output>
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
              disabled={!canBuy || mutating || adding}
              className={`catalog-primary-button product-buy__primary ${justAdded ? "is-confirmed" : ""}`}
              aria-live="polite"
            >
              {adding ? (
                <>
                  <span className="jovy-spinner" aria-hidden="true" /> {copy.adding}
                </>
              ) : justAdded ? (
                <>✓ {copy.added}</>
              ) : (
                copy.addToCart
              )}
            </button>
          </div>

          <ul className="product-trust" aria-label={copy.demoNote}>
            <li>{copy.shippingDemo}</li>
            <li>{copy.paymentDemo}</li>
            <li>{copy.madeIn}</li>
          </ul>

          <p className="product-buy__note">
            {commerce ? copy.demoNote : copy.priceUnavailable}
          </p>
        </>
      )}

      <ContactTrigger className="catalog-secondary-button product-buy__secondary">
        {dictionary.catalog.askQuestion}
      </ContactTrigger>

      <div
        className={`product-sticky-buy ${stickyVisible && canBuy ? "is-visible" : ""}`}
        aria-hidden={stickyVisible && canBuy ? undefined : true}
      >
        <span className="product-sticky-buy__price">
          {weightLabel(variant?.title) ?? fallbackWeight ?? productTitle}
          <strong>{formatMoney(price, currency, locale)}</strong>
        </span>
        <button
          type="button"
          onClick={() => void add()}
          disabled={!canBuy || adding}
          className="product-sticky-buy__action"
        >
          {adding ? copy.adding : copy.addToCart}
        </button>
      </div>
    </div>
  )
}
