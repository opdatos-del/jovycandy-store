"use client"

import { useState, type CSSProperties } from "react"

import { cardVisualStyle, type CardVisual } from "@/lib/commerce/card-visual"

type ProductCardVisualProps = {
  title: string
  image: string | null
  imageSrcSet?: string
  visual: CardVisual
  priority?: boolean
  noImageLabel: string
}

/**
 * Motor visual de la tarjeta. Solo recibe URLs y configuración resuelta:
 * no conoce Medusa, presets ni reglas comerciales.
 */
export function ProductCardVisual({
  title,
  image,
  imageSrcSet,
  visual,
  priority = false,
  noImageLabel,
}: ProductCardVisualProps) {
  const [failedLayer, setFailedLayer] = useState<"swap" | "overlay" | null>(null)
  const [baseFailed, setBaseFailed] = useState(false)
  const style = cardVisualStyle(visual) as CSSProperties

  const showOverlay = visual.mode === "layered" && Boolean(visual.overlayUrl) && failedLayer !== "overlay"
  const showSwap = visual.mode === "swap" && Boolean(visual.swapUrl) && failedLayer !== "swap"

  return (
    <span className="catalog-card__media" data-visual={visual.mode} style={style}>
      {showOverlay ? (
        <img
          src={visual.overlayUrl ?? undefined}
          alt=""
          aria-hidden="true"
          width={1600}
          height={1600}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="catalog-card__layer catalog-card__layer--decor"
          onError={() => setFailedLayer("overlay")}
        />
      ) : null}

      {image && !baseFailed ? (
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
          onError={() => setBaseFailed(true)}
        />
      ) : (
        <span className="catalog-card__placeholder">{noImageLabel}</span>
      )}

      {showSwap ? (
        <img
          src={visual.swapUrl ?? undefined}
          alt=""
          aria-hidden="true"
          width={1600}
          height={1600}
          loading="lazy"
          decoding="async"
          fetchPriority="low"
          className="catalog-card__layer catalog-card__layer--swap"
          onError={() => setFailedLayer("swap")}
        />
      ) : null}
    </span>
  )
}
