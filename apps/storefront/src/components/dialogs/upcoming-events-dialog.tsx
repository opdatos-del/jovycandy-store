"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { CloseIcon } from "@/components/icons"
import type { CmsBanner, CmsEvent } from "@/lib/cms/client"
import type { Dictionary } from "@/lib/i18n"

type UpcomingEventsDialogProps = {
  banners: CmsBanner[]
  events: CmsEvent[]
  dictionary: Dictionary
}

type Slide = {
  id: string
  image: string
  alt: string
}

const EVENTS_IMAGE_PREFIX = "/assets/marketing/events/"
const AUTO_OPEN_DELAY_MS = 900
const ONCE_KEY = "jovy:announcements:once"
const SESSION_KEY = "jovy:announcements:session"
const DAILY_KEY = "jovy:announcements:daily"
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"
const SWIPE_THRESHOLD = 48

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function eventImage(image: string) {
  if (!image.startsWith(EVENTS_IMAGE_PREFIX)) return image
  return image.replace(/\.webp$/, "-960.webp")
}

function canAutoOpen(frequency: CmsBanner["frequency"]) {
  try {
    if (frequency === "once") {
      if (window.localStorage.getItem(ONCE_KEY) === "1") return false
      window.localStorage.setItem(ONCE_KEY, "1")
      return true
    }
    if (frequency === "session") {
      if (window.sessionStorage.getItem(SESSION_KEY) === "1") return false
      window.sessionStorage.setItem(SESSION_KEY, "1")
      return true
    }
    if (frequency === "daily") {
      const today = new Date().toDateString()
      if (window.localStorage.getItem(DAILY_KEY) === today) return false
      window.localStorage.setItem(DAILY_KEY, today)
      return true
    }
  } catch {
    return false
  }
  return true
}

export function UpcomingEventsDialog({ banners, events, dictionary }: UpcomingEventsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [imageRatio, setImageRatio] = useState<number | null>(null)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dragStartX = useRef<number | null>(null)
  const draggedDistance = useRef(0)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)

  const slides = useMemo<Slide[]>(() => {
    const bannerSlides = banners
      .filter((banner) => Boolean(banner.image))
      .map((banner) => ({
        id: `banner-${banner.id}`,
        image: banner.image as string,
        alt: banner.alt || banner.title,
      }))

    const eventSlides = events
      .filter((event) => Boolean(event.image))
      .map((event) => ({
        id: `event-${event.id}`,
        image: eventImage(event.image as string),
        alt: event.title,
      }))

    return [...bannerSlides, ...eventSlides].slice(0, 9)
  }, [banners, events])

  const rotationMs = useMemo(() => {
    const seconds = banners.find((banner) => banner.image)?.rotationSeconds ?? 8
    return Math.min(60_000, Math.max(3_000, seconds * 1000))
  }, [banners])

  const current = slides[activeIndex % Math.max(1, slides.length)] ?? null
  const isCarousel = slides.length > 1

  const openDialog = useCallback(() => {
    setActiveIndex(0)
    setOpen(true)
  }, [])

  const goTo = (index: number) => {
    setActiveIndex((index + slides.length) % slides.length)
  }

  useEffect(() => {
    if (!slides.length) return
    const first = slides[0]
    const image = new Image()
    image.onload = () => {
      if (image.naturalWidth > 0 && image.naturalHeight > 0) {
        setImageRatio(image.naturalWidth / image.naturalHeight)
      }
    }
    image.src = first.image
    return () => {
      image.onload = null
    }
  }, [slides])

  useEffect(() => {
    const onOpen = () => openDialog()
    window.addEventListener("jovy:events:open", onOpen)
    return () => window.removeEventListener("jovy:events:open", onOpen)
  }, [openDialog])

  useEffect(() => {
    const primary = banners.find((banner) => banner.autoOpen && banner.image)
    if (!primary) return
    const timer = window.setTimeout(() => {
      if (canAutoOpen(primary.frequency)) openDialog()
    }, AUTO_OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [banners, openDialog])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isCarousel) return
      if (event.key === "ArrowLeft") goTo(activeIndex - 1)
      else if (event.key === "ArrowRight") goTo(activeIndex + 1)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, isCarousel, activeIndex, slides.length])

  useEffect(() => {
    if (!open || !isCarousel || paused || reducedMotion) return
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length)
    }, rotationMs)
    return () => window.clearInterval(timer)
  }, [open, isCarousel, paused, reducedMotion, rotationMs, slides.length])

  const handleDragStart = (event: React.PointerEvent) => {
    if (!isCarousel || typeof event.clientX !== "number") return
    dragStartX.current = event.clientX
    draggedDistance.current = 0
    setDragging(true)
  }

  const handleDragMove = (event: React.PointerEvent) => {
    if (dragStartX.current === null) return
    draggedDistance.current = event.clientX - dragStartX.current
    setDragOffset(draggedDistance.current)
  }

  const handleDragEnd = () => {
    if (dragStartX.current === null) return
    dragStartX.current = null
    setDragging(false)
    setDragOffset(0)
    if (Math.abs(draggedDistance.current) > SWIPE_THRESHOLD) {
      goTo(activeIndex + (draggedDistance.current < 0 ? 1 : -1))
    }
  }

  const figureWidth = imageRatio
    ? `min(94vw, 640px, calc(80vh * ${imageRatio}))`
    : "min(94vw, 640px)"

  return (
    <dialog
      ref={dialogRef}
      onClose={() => setOpen(false)}
      aria-label={current?.alt || dictionary.nav.upcomingEvents}
      className="events-modal fixed inset-0 m-auto h-full max-h-none w-full max-w-none bg-transparent p-0"
    >
      <div
        className="fixed inset-0 flex items-center justify-center bg-[#2e1a0d]/60 p-4 backdrop-blur-md"
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false)
        }}
      >
        {current ? (
          <figure
            className="promo-card promo-card--figure relative"
            style={{ width: figureWidth, aspectRatio: imageRatio ? String(imageRatio) : "16 / 11" }}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div
              className="promo-card-image-window select-none"
              style={{
                transform: `translateX(${dragOffset}px)`,
                transition: dragging ? "none" : "transform 0.25s ease",
                touchAction: "pan-y",
                cursor: isCarousel ? "grab" : "default",
              }}
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              onPointerCancel={handleDragEnd}
              onPointerLeave={handleDragEnd}
            >
              <img
                key={current.image}
                src={current.image}
                alt={current.alt}
                className="promo-card-image"
                draggable={false}
                decoding="async"
                onLoad={(event) => {
                  const image = event.currentTarget
                  if (image.naturalWidth > 0 && image.naturalHeight > 0) {
                    setImageRatio(image.naturalWidth / image.naturalHeight)
                  }
                }}
              />
            </div>

            {isCarousel ? (
              <div
                role="tablist"
                aria-label={dictionary.promoBanner.navigationLabel}
                className="absolute bottom-12 left-0 right-0 z-10 flex items-center justify-center gap-1.5"
              >
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    type="button"
                    role="tab"
                    aria-selected={index === activeIndex}
                    aria-label={dictionary.promoBanner.goToSlide.replace("{{n}}", String(index + 1))}
                    onClick={() => goTo(index)}
                    className="flex h-11 w-7 items-center justify-center"
                  >
                    <span
                      className={`block h-2 rounded-full transition-all ${
                        index === activeIndex ? "w-6 bg-[#e8822e]" : "w-2 bg-white/60 hover:bg-white/90"
                      }`}
                    />
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={dictionary.promoBanner.close}
              className="absolute right-2.5 top-2.5 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-stone-900/45 text-white shadow-md backdrop-blur-md transition-all hover:scale-105 hover:bg-stone-900/65"
            >
              <CloseIcon className="h-4 w-4" />
            </button>

            {isCarousel ? (
              <figcaption className="absolute bottom-2.5 left-0 right-0 z-10 flex items-center justify-center">
                <span
                  aria-live="polite"
                  className="rounded-full border border-white/20 bg-stone-950/35 px-2.5 py-0.5 text-[11px] font-semibold text-white/90 backdrop-blur-md"
                >
                  {activeIndex + 1} / {slides.length}
                </span>
              </figcaption>
            ) : null}
          </figure>
        ) : (
          <div className="promo-card relative w-[min(94vw,420px)] rounded-[2rem] p-8 text-center">
            <h2 className="font-serif text-2xl font-semibold text-[#8a4f17]">{dictionary.promoBanner.title}</h2>
            <p className="mt-2 text-sm text-[#6b4a26]">{dictionary.promoBanner.subtitle}</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 inline-flex min-h-[44px] items-center rounded-full bg-[#e8822e] px-6 py-2 text-sm font-bold text-white shadow-md transition hover:scale-105 hover:bg-[#d06f1f]"
            >
              {dictionary.promoBanner.understood}
            </button>
          </div>
        )}
      </div>
    </dialog>
  )
}
