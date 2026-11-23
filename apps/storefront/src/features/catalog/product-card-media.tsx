"use client"

import { useState, type CSSProperties } from "react"

import type { CardHoverConfig } from "@/lib/medusa/store"

type ProductCardMediaProps = {
  title: string
  image: string | null
  imageSrcSet?: string
  hover?: CardHoverConfig | null
  priority?: boolean
  noImageLabel: string
}

/**
 * Visual de tarjeta: bolsa base siempre visible y una capa decorativa opcional.
 * - layered: gomitas detrás de la bolsa; la bolsa no cambia de tamaño.
 * - swap: composición completa con crossfade.
 * Si la capa falla, se oculta y queda el thumbnail base.
 */
export function ProductCardMedia({
  title,
  image,
  imageSrcSet,
  hover,
  priority = false,
  noImageLabel,
}: ProductCardMediaProps) {
  const [layerFailed, setLayerFailed] = useState(false)
  const style = hover?.background
    ? ({ "--card-hover-bg": hover.background } as CSSProperties)
    : undefined

  const showLayered = hover?.mode === "layered" && Boolean(hover.overlayUrl) && !layerFailed
  const showSwap = hover?.mode === "swap" && Boolean(hover.fullUrl) && !layerFailed

  return (
    <span className="catalog-card__media" style={style}>
      {showLayered ? (
        <img
          src={hover?.overlayUrl ?? undefined}
          alt=""
          aria-hidden="true"
          width={1600}
          height={1600}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="catalog-card__layer catalog-card__layer--gomitas"
          onError={() => setLayerFailed(true)}
        />
      ) : null}

      {image ? (
        <img
          src={image}
          srcSet={imageSrcSet}
          sizes="(max-width: 480px) 45vw, (max-width: 900px) 30vw, 240px"
          alt={title}
          width={640}
          height={640}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          className="catalog-card__layer catalog-card__layer--base"
        />
      ) : (
        <span className="catalog-card__placeholder">{noImageLabel}</span>
      )}

      {showSwap ? (
        <img
          src={hover?.fullUrl ?? undefined}
          alt=""
          aria-hidden="true"
          width={1600}
          height={1600}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="catalog-card__layer catalog-card__layer--swap"
          onError={() => setLayerFailed(true)}
        />
      ) : null}
    </span>
  )
}
