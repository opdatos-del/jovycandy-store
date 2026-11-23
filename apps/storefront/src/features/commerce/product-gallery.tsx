"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

type ProductGalleryProps = {
  images: string[]
  alt: string
  labels: { gallery: string; viewImage: string; closeImage: string; noImage: string }
  badges?: ReactNode
}

export function ProductGallery({ images, alt, labels, badges }: ProductGalleryProps) {
  const [active, setActive] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const current = images[active] ?? images[0]

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (zoomed && !dialog.open) dialog.showModal()
    else if (!zoomed && dialog.open) dialog.close()
  }, [zoomed])

  if (!current) {
    return (
      <div className="product-gallery">
        <div className="product-gallery__frame">
          <span className="catalog-card__placeholder">{labels.noImage}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="product-gallery">
      <div className="product-gallery__frame">
        {badges}
        <button
          type="button"
          onClick={() => setZoomed(true)}
          className="product-gallery__zoom"
          aria-label={labels.viewImage}
        >
          <img
            key={current}
            src={current}
            alt={alt}
            width={640}
            height={640}
            fetchPriority="high"
            decoding="async"
            className="product-gallery__image"
          />
          <span className="product-gallery__hint" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4M11 8v6M8 11h6" />
            </svg>
          </span>
        </button>
      </div>

      {images.length > 1 ? (
        <div className="product-gallery__thumbs" role="group" aria-label={labels.gallery}>
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              onClick={() => setActive(index)}
              className={index === active ? "is-active" : undefined}
              aria-label={`${labels.gallery} ${index + 1}`}
              aria-pressed={index === active}
            >
              <img src={image} alt="" width={96} height={96} loading="lazy" />
            </button>
          ))}
        </div>
      ) : null}

      <dialog
        ref={dialogRef}
        aria-label={labels.viewImage}
        onClose={() => setZoomed(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setZoomed(false)
        }}
        className="product-lightbox"
      >
        <div className="product-lightbox__inner">
          <button
            type="button"
            onClick={() => setZoomed(false)}
            aria-label={labels.closeImage}
            className="product-lightbox__close"
          >
            ×
          </button>
          <img src={current} alt={alt} width={900} height={900} />
        </div>
      </dialog>
    </div>
  )
}
