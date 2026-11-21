"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"

import type { CmsEvent, HomeContent } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary } from "@/lib/i18n"

type EventsSectionProps = {
  content: HomeContent
  dictionary: Dictionary
}

type DragState = {
  down: boolean
  startX: number
  startLeft: number
  moved: boolean
}

const EMPTY_DRAG: DragState = { down: false, startX: 0, startLeft: 0, moved: false }

const EVENTS_IMAGE_PREFIX = "/assets/marketing/events/"

function cardImage(image: string) {
  if (!image.startsWith(EVENTS_IMAGE_PREFIX)) return image
  return image.replace(/\.webp$/, "-720.webp")
}

function fullImage(image: string) {
  if (!image.startsWith(EVENTS_IMAGE_PREFIX)) return image
  return image.replace(/\.webp$/, "-960.webp")
}

export function EventsSection({ content, dictionary }: EventsSectionProps) {
  const events = useMemo(() => content.events.slice(0, 8), [content.events])
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const dragRef = useRef<DragState>({ ...EMPTY_DRAG })
  const [dragging, setDragging] = useState(false)
  const [activeEvent, setActiveEvent] = useState<CmsEvent | null>(null)
  const [progress, setProgress] = useState(0)
  const [pages, setPages] = useState(1)
  const [hasOverflow, setHasOverflow] = useState(false)

  const updateScrollState = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const maxScroll = viewport.scrollWidth - viewport.clientWidth
    setHasOverflow(maxScroll > 4)
    if (maxScroll <= 4) {
      setProgress(0)
      setPages(1)
      return
    }
    setProgress(viewport.scrollLeft / maxScroll)
    setPages(Math.max(1, Math.ceil(viewport.scrollWidth / viewport.clientWidth)))
  }, [])

  useEffect(() => {
    const viewport = viewportRef.current
    const track = trackRef.current
    if (!viewport) return
    updateScrollState()
    if (typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(viewport)
    if (track) observer.observe(track)
    return () => observer.disconnect()
  }, [updateScrollState])

  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      const state = dragRef.current
      if (!state.down) return
      const viewport = viewportRef.current
      if (!viewport) return
      const delta = event.clientX - state.startX
      if (Math.abs(delta) > 4) state.moved = true
      if (state.moved) viewport.scrollLeft = state.startLeft - delta
    }
    const onUp = () => {
      if (!dragRef.current.down) return
      dragRef.current.down = false
      setDragging(false)
      // El click se dispara después de pointerup; se limpia en el siguiente turno.
      window.setTimeout(() => {
        dragRef.current.moved = false
      }, 0)
    }
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [])

  useEffect(() => {
    if (!activeEvent) return
    const previous = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previous
    }
  }, [activeEvent])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (activeEvent && !dialog.open) dialog.showModal()
    if (!activeEvent && dialog.open) dialog.close()
  }, [activeEvent])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return
    const viewport = viewportRef.current
    if (!viewport) return
    dragRef.current = {
      down: true,
      startX: event.clientX,
      startLeft: viewport.scrollLeft,
      moved: false,
    }
    setDragging(true)
  }

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current.moved) return
    event.preventDefault()
    event.stopPropagation()
  }

  const scrollToPage = (index: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    viewport.scrollTo({ left: index * viewport.clientWidth, behavior: "smooth" })
  }

  const activePage = Math.round(progress * (pages - 1))

  return (
    <section
      id="eventos"
      className="events-section relative overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-20"
      style={{
        backgroundImage: "linear-gradient(180deg, #fff5d4 0%, #fff8e0 50%, #fff5d4 100%)",
        // Las media queries históricas de `.events-section` no están en una capa
        // y pisan las utilidades de Tailwind; el padding va inline para mandar.
        paddingTop: "clamp(3.5rem, 6vw, 6rem)",
        paddingBottom: "clamp(3.5rem, 5vw, 5rem)",
      }}
    >
      <div className="relative z-10">
        <div className="events-section-header mx-auto flex max-w-full flex-col items-center gap-3 px-4 text-center sm:gap-4 sm:px-6 md:px-7 lg:px-8">
          <div className="flex flex-col items-center">
            <h2 className="text-4xl font-semibold tracking-[0.03em] text-stone-800 md:text-5xl lg:text-6xl">{dictionary.events.title}</h2>
            <p className="mt-1 text-base font-light tracking-wide text-stone-500 md:text-lg lg:text-xl">{dictionary.events.swipeHint}</p>
          </div>
        </div>

        <div className="relative">
          <div
            ref={viewportRef}
            onPointerDown={handlePointerDown}
            onClickCapture={handleClickCapture}
            onScroll={updateScrollState}
            className={`events-viewport mobile-scroll relative mt-6 overflow-x-auto overflow-y-visible px-4 pb-4 sm:px-6 md:px-7 lg:px-8 xl:px-10 2xl:px-12 ${
              dragging ? "cursor-grabbing select-none" : "cursor-grab"
            }`}
          >
            {hasOverflow ? (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-[#fff7e2] via-[#fff7e2]/60 to-transparent sm:w-16" />
            ) : null}
            <div
              ref={trackRef}
              className={`events-track flex w-max min-w-full snap-x snap-mandatory flex-nowrap items-start gap-4 pr-4 sm:gap-5 sm:pr-5 md:gap-6 md:pr-6 lg:gap-7 lg:pr-8 xl:gap-8 xl:pr-10 2xl:gap-9 2xl:pr-12 ${
                dragging ? "snap-none" : ""
              }`}
            >
              {events.map((event) => (
                <div
                  key={event.id}
                  className="w-[clamp(17rem,84vw,19rem)] flex-shrink-0 snap-start sm:w-[clamp(17rem,74vw,20rem)] md:w-[clamp(18rem,42vw,21rem)] lg:w-[clamp(19rem,28vw,23rem)] xl:w-[clamp(20rem,24vw,24rem)] 2xl:w-[clamp(21rem,22vw,25rem)]"
                >
                  <article className="events-card group relative h-full w-full">
                    <button
                      type="button"
                      onClick={() => setActiveEvent(event)}
                      aria-label={`${dictionary.events.viewFull} ${event.title}`}
                      className="flex h-full w-full overflow-hidden rounded-[1.4rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.98),rgba(255,244,219,0.94))] p-2 text-left shadow-[0_18px_44px_rgba(79,54,26,0.12)] transition-shadow duration-300 hover:shadow-[0_24px_56px_rgba(79,54,26,0.18)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-stone-700 sm:rounded-[1.6rem] sm:p-2.5 md:rounded-[1.75rem] md:p-3 lg:rounded-[1.9rem]"
                    >
                      <span className="relative block w-full overflow-hidden rounded-[1.1rem] bg-white/80 sm:rounded-[1.25rem] md:rounded-[1.35rem] lg:rounded-[1.45rem]">
                        {event.image ? (
                          <img
                            src={cardImage(event.image)}
                            srcSet={event.image.startsWith(EVENTS_IMAGE_PREFIX) ? responsiveSrcSet(event.image, [480, 720, 960]) : undefined}
                            sizes="(max-width: 640px) 84vw, (max-width: 1024px) 42vw, 23rem"
                            alt={event.title}
                            className="events-card-media aspect-[3/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                            width={720}
                            height={1200}
                            loading="lazy"
                            fetchPriority="low"
                            decoding="async"
                            draggable={false}
                          />
                        ) : null}
                        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_30%,rgba(0,0,0,0.1)_100%)]" />
                      </span>
                    </button>
                  </article>
                </div>
              ))}
            </div>
          </div>
        </div>

        {hasOverflow ? (
          <div className="flex items-center justify-center gap-3 pb-2 pt-4 sm:gap-4 sm:pt-5">
            <button
              type="button"
              onClick={() => scrollToPage(Math.max(0, activePage - 1))}
              disabled={activePage === 0}
              aria-label={dictionary.events.previous}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white/85 text-stone-600 transition hover:bg-white disabled:cursor-default disabled:opacity-35"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="h-4 w-4">
                <path d="m15 5-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              {Array.from({ length: pages }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => scrollToPage(index)}
                  aria-label={`${dictionary.events.goToPage} ${index + 1}`}
                  aria-current={index === activePage || undefined}
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <span
                    className={`block rounded-full transition-all duration-300 ${
                      index === activePage ? "h-2.5 w-2.5 bg-stone-700/80" : "h-2 w-2 bg-stone-700/25"
                    }`}
                  />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => scrollToPage(Math.min(pages - 1, activePage + 1))}
              disabled={activePage >= pages - 1}
              aria-label={dictionary.events.next}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-stone-300 bg-white/85 text-stone-600 transition hover:bg-white disabled:cursor-default disabled:opacity-35"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="h-4 w-4">
                <path d="m9 5 7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        ) : null}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setActiveEvent(null)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setActiveEvent(null)
        }}
        aria-label={activeEvent ? activeEvent.title : undefined}
        className="events-modal fixed inset-0 m-auto h-full max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-stone-950/85"
      >
        {activeEvent ? (
          <div
            className="flex h-full w-full items-center justify-center p-4 sm:p-8"
            onClick={(event) => {
              if (event.target === event.currentTarget) setActiveEvent(null)
            }}
          >
            <button
              type="button"
              onClick={() => setActiveEvent(null)}
              aria-label={dictionary.events.close}
              className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-stone-800 shadow-lg transition hover:bg-white sm:right-6 sm:top-6"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true" className="h-5 w-5">
                <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
              </svg>
            </button>
            {activeEvent.video ? (
              <video
                src={activeEvent.video}
                className="events-modal-image max-h-[88vh] max-w-[92vw] rounded-lg bg-white object-contain shadow-[0_20px_80px_rgba(0,0,0,0.5)] sm:rounded-xl md:rounded-2xl"
                controls
                autoPlay
                playsInline
                onClick={(event) => event.stopPropagation()}
              />
            ) : activeEvent.image ? (
              <img
                src={fullImage(activeEvent.image)}
                alt={activeEvent.title}
                className="events-modal-image max-h-[88vh] max-w-[92vw] rounded-lg bg-white object-contain shadow-[0_20px_80px_rgba(0,0,0,0.5)] sm:rounded-xl md:rounded-2xl"
                decoding="async"
                draggable={false}
                onClick={(event) => event.stopPropagation()}
              />
            ) : null}
          </div>
        ) : null}
      </dialog>
    </section>
  )
}
