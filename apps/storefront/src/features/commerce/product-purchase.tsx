"use client"

import { useEffect, useMemo, useRef, useState } from "react"

import { ContactTrigger } from "@/components/contact-trigger"
import { formatMoney } from "@/lib/commerce/format"
import { sortByWeight, weightLabel } from "@/lib/commerce/weight"
import type { CommerceProduct, CommerceVariant } from "@/lib/medusa/store"
import type { Dictionary, Locale } from "@/lib/i18n"

import { useCommerce } from "./cart-provider"
import { useToast } from "./toast-provider"
import { SaveToList } from "./save-to-list"

type ProductPurchaseProps = {
  locale: Locale
  dictionary: Dictionary
  commerce: CommerceProduct | null
  catalogOnly: boolean
  productTitle: string
  fallbackWeight?: string | null
}

function isVariantAvailable(variant: CommerceVariant | undefined) {
  if (!variant || variant.price === null) return false
  if (!variant.manageInventory || variant.allowBackorder) return true
  return (variant.inventoryQuantity ?? 0) > 0
}

function maxQuantity(variant: CommerceVariant | undefined) {
  if (!variant || !variant.manageInventory || variant.allowBackorder) return 99
  return Math.min(99, Math.max(0, Math.floor(variant.inventoryQuantity ?? 0)))
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
  const { addItem, mutating } = useCommerce()
  const { notify } = useToast()
  const rootRef = useRef<HTMLDivElement>(null)
  const confirmationTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [stickyVisible, setStickyVisible] = useState(false)

  const variants = useMemo(
    () => sortByWeight(commerce?.variants ?? []),
    [commerce],
  )
  const [variantId, setVariantId] = useState<string>(
    variants.find(isVariantAvailable)?.id ?? variants[0]?.id ?? "",
  )
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const variant = variants.find((item) => item.id === variantId) ?? variants[0]
  const price = variant?.price ?? null
  const currency = variant?.currencyCode ?? "mxn"
  const available = isVariantAvailable(variant)
  const quantityLimit = maxQuantity(variant)
  const purchaseQuantity = Math.min(quantity, Math.max(1, quantityLimit))
  const canBuy = Boolean(commerce && variant && available && !catalogOnly)

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

  useEffect(
    () => () => {
      if (confirmationTimer.current) clearTimeout(confirmationTimer.current)
    },
    [],
  )

  const add = async () => {
    if (!variant || !canBuy || adding) return
    setAdding(true)
    try {
      await addItem(variant.id, purchaseQuantity)
      notify({
        title: copy.addedToCart,
        description: `${productTitle} · ${weightLabel(variant.title) ?? variant.title}`,
      })
      setJustAdded(true)
      confirmationTimer.current = setTimeout(() => setJustAdded(false), 1600)
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
    : variant.price === null
      ? copy.priceUnavailable
      : !variant.manageInventory
        ? copy.inventoryUnverified
        : variant.allowBackorder
          ? copy.backorder
          : available
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
              <div className="product-variants__options">
                {variants.map((item) => {
                  const selected = item.id === variant?.id
                  const itemAvailable = isVariantAvailable(item)
                  return (
                    <label
                      key={item.id}
                      className={`${selected ? "is-selected" : ""}${itemAvailable ? "" : " is-unavailable"}`}
                    >
                      <input
                        type="radio"
                        name="product-variant"
                        value={item.id}
                        checked={selected}
                        aria-disabled={!itemAvailable}
                        onChange={() => {
                          if (!itemAvailable) return
                          setVariantId(item.id)
                          setQuantity(1)
                        }}
                      />
                      <span>{weightLabel(item.title) ?? item.title}</span>
                      <small>
                        {item.price === null
                          ? copy.priceUnavailable
                          : formatMoney(item.price, item.currencyCode ?? currency, locale)}
                        {item.onSale && item.originalPrice !== null ? (
                          <s className="product-variant__original">
                            {formatMoney(item.originalPrice, item.currencyCode ?? currency, locale)}
                          </s>
                        ) : null}
                      </small>
                      {!itemAvailable ? (
                        <span className="product-variant__unavailable">{copy.unavailable}</span>
                      ) : null}
                    </label>
                  )
                })}
              </div>
            </fieldset>
          ) : null}

          <div className="product-buy__price">
            <div>
              {variant?.onSale && variant.originalPrice !== null ? (
                <s className="product-buy__original">
                  {formatMoney(variant.originalPrice, currency, locale)}
                </s>
              ) : null}
              <span key={variant?.id} className="product-buy__amount jovy-pop">
                {price === null
                  ? copy.priceUnavailable
                  : formatMoney(price, currency, locale)}
              </span>
              {variant?.onSale ? <span className="product-buy__sale">{copy.onSale}</span> : null}
            </div>
            <span
              className={`product-buy__availability ${available ? "" : "is-unavailable"}`}
            >
              {availability}
            </span>
          </div>

          <div className="product-buy__row">
            <div className="product-quantity" role="group" aria-label={copy.quantity}>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label={copy.decrease}
              >
                −
              </button>
              <output aria-live="polite">{purchaseQuantity}</output>
              <button
                type="button"
                onClick={() => setQuantity((value) => Math.min(quantityLimit, value + 1))}
                disabled={quantity >= quantityLimit}
                aria-label={copy.increase}
              >
                +
              </button>
            </div>
            <button
              type="button"
              onClick={() => void add()}
              disabled={!canBuy || mutating || adding}
              aria-busy={adding}
              className={`catalog-primary-button product-buy__primary ${justAdded ? "is-confirmed" : ""}`}
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

          {variant?.manageInventory && !variant.allowBackorder ? (
            <p className="product-buy__note">
              {copy.maxQuantity.replace("{{count}}", String(quantityLimit))}
            </p>
          ) : null}

          {variant ? <SaveToList key={variant.id} variantId={variant.id} locale={locale} /> : null}

          <ul className="product-trust" aria-label={copy.demoNote}>
            <li>{copy.shippingDemo}</li>
            <li>{copy.madeIn}</li>
          </ul>

          <p className="product-buy__note">
            {price === null ? copy.priceUnavailable : copy.demoNote}
          </p>
        </>
      )}

      <ContactTrigger className="catalog-secondary-button product-buy__secondary">
        {dictionary.catalog.askQuestion}
      </ContactTrigger>

      <div
        className={`product-sticky-buy ${stickyVisible && canBuy ? "is-visible" : ""}`}
        hidden={!(stickyVisible && canBuy)}
      >
        <span className="product-sticky-buy__price">
          {weightLabel(variant?.title) ?? fallbackWeight ?? productTitle}
          <strong>
            {price === null ? copy.priceUnavailable : formatMoney(price, currency, locale)}
          </strong>
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
