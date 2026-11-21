"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"

import { ArrowRightIcon } from "@/components/icons"
import type { CmsProduct, HomeContent } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"

type HeroPromoProps = {
  locale: Locale
  dictionary: Dictionary
  content: HomeContent
  fallbackProducts: CmsProduct[]
}

type HeroPromoItem = {
  id: string
  image: string
  name: string
  srcSet?: string
}

const MARQUEE = "NUEVO PRODUCTO • NUEVO PRODUCTO • NUEVO PRODUCTO • NUEVO PRODUCTO • NUEVO PRODUCTO •"

const ROTATION_INTERVAL_MS = 4000
const MAX_PROMOS = 5
const FALLBACK_IMAGE = "/assets/marketing/hero/mini-sharks.webp"

const RAYS_STYLE = {
  backgroundImage:
    "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.75) 0deg 5deg, rgba(255,255,255,0) 5deg 20deg)",
  WebkitMaskImage: "radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 16%, rgba(0,0,0,0) 80%)",
  maskImage: "radial-gradient(circle, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 16%, rgba(0,0,0,0) 80%)",
  position: "absolute",
  top: "50%",
  left: "50%",
  width: "min(130%, 46rem)",
  height: "min(130%, 46rem)",
  translate: "-50% -50%",
} as const

// Imágenes de demostración del seed de Medusa que no pertenecen a Jovy.
const DEMO_IMAGE_HINTS = ["medusa-public-images"]

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

function isUsableProductImage(image: string | null | undefined): image is string {
  if (!image) return false
  return !DEMO_IMAGE_HINTS.some((hint) => image.includes(hint))
}

function optimizedImage(image: string): { src: string; srcSet?: string } {
  if (image === "/assets/marketing/hero/mini-sharks.webp") {
    return {
      src: "/assets/marketing/hero/mini-sharks-800.webp",
      srcSet: responsiveSrcSet(image, [480, 800, 1200]),
    }
  }
  if (image.startsWith("/assets/catalog/products/") && image.endsWith(".webp")) {
    return { src: image.replace(/\.webp$/, "-640.webp") }
  }
  return { src: image }
}

function buildPromos(content: HomeContent, fallbackProducts: CmsProduct[]): HeroPromoItem[] {
  // El hero histórico rotaba los productos del CMS; aquí se reutilizan los
  // mismos productos publicados y, si aún no hay CMS, los del catálogo local.
  const seen = new Set<string>()
  const promos: HeroPromoItem[] = []

  for (const product of [...content.products, ...fallbackProducts]) {
    if (!isUsableProductImage(product.thumbnail) || seen.has(product.thumbnail)) continue
    seen.add(product.thumbnail)
    const optimized = optimizedImage(product.thumbnail)
    promos.push({ id: product.id, image: optimized.src, srcSet: optimized.srcSet, name: product.title })
    if (promos.length === MAX_PROMOS) break
  }

  if (promos.length > 0) return promos

  const optimized = optimizedImage(content.hero?.image || FALLBACK_IMAGE)
  return [
    {
      id: "hero-fallback",
      image: optimized.src,
      srcSet: optimized.srcSet,
      name: content.hero?.title || "MINI SHARKS",
    },
  ]
}

export function HeroPromo({ locale, dictionary, content, fallbackProducts }: HeroPromoProps) {
  const hero = content.hero
  const promos = useMemo(() => buildPromos(content, fallbackProducts), [content, fallbackProducts])
  const [activeIndex, setActiveIndex] = useState(0)
  const [renderIndices, setRenderIndices] = useState<Set<number>>(() => new Set([0, 1]))
  const previousIndexRef = useRef(0)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)

  const activePromo = promos[activeIndex % promos.length] ?? promos[0]
  const title = activePromo?.name || hero?.title || "MINI SHARKS"
  const ctaUrl = hero?.ctaUrl || `/${locale}/catalogo`

  useEffect(() => {
    if (promos.length < 2 || reducedMotion) return
    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % promos.length)
    }, ROTATION_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [promos.length, reducedMotion])

  useEffect(() => {
    // Solo se mantienen montadas la imagen activa, la saliente y la siguiente:
    // así la rotación no descarga los cinco productos al cargar el hero.
    const previous = previousIndexRef.current
    if (previous === activeIndex) return
    const nextIndex = (activeIndex + 1) % promos.length

    setRenderIndices((current) => {
      const next = new Set(current)
      next.add(previous)
      next.add(activeIndex)
      next.add(nextIndex)
      return next
    })
    previousIndexRef.current = activeIndex

    const timer = window.setTimeout(() => {
      setRenderIndices(new Set([activeIndex, nextIndex]))
    }, 750)
    return () => window.clearTimeout(timer)
  }, [activeIndex, promos.length])

  return (
    <section
      id="inicio"
      className="relative min-h-[100svh] w-full overflow-hidden"
      style={{ backgroundColor: hero?.backgroundColor || "#00AFAA", transition: "background-color 900ms ease" }}
    >
      <h1 className="sr-only">{hero?.title ? `${hero.title} — Jovy Candy` : "Jovy Candy — Dulces mexicanos"}</h1>
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 top-0 z-[1] h-[clamp(3.25rem,6vw,6.25rem)] w-full"
        role="presentation"
      >
        <path d="M0 68C43 75 94 80 154 79C263 77 369 57 478 42C587 27 699 17 811 24C923 31 1018 55 1121 60C1224 65 1330 58 1440 28V0H0Z" fill="#edf5ff" />
      </svg>

      <div aria-hidden="true" className="hero-backdrop-copy pointer-events-none absolute inset-0 flex flex-col justify-between overflow-hidden">
        {Array.from({ length: 10 }, (_, row) => (
          <div key={row} className="hero-backdrop-row overflow-hidden whitespace-nowrap">
            <div
              className={`hero-backdrop-track ${row % 2 === 0 ? "hero-backdrop-track-forward" : "hero-backdrop-track-reverse"}`}
              style={{ "--hero-backdrop-duration": `${28 + (row % 4) * 4}s` } as React.CSSProperties}
            >
              <span className="hero-backdrop-copy-text text-6xl font-black uppercase tracking-[0.02em] text-white/[0.065] md:text-7xl lg:text-8xl xl:text-9xl">{MARQUEE}</span>
              <span aria-hidden="true" className="hero-backdrop-copy-text text-6xl font-black uppercase tracking-[0.02em] text-white/[0.065] md:text-7xl lg:text-8xl xl:text-9xl">{MARQUEE}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="hero-layout relative z-10 flex min-h-[100svh] w-full items-center justify-center">
        <div className="w-full max-w-[min(96vw,var(--hero-max-width))]">
          <div className="hero-shell relative flex flex-col items-center justify-center md:justify-between">
            <div className="hero-content group relative flex w-full flex-none flex-col items-center justify-center text-center">
              <div className="hero-promo-stage relative z-10 mx-auto w-full max-w-[min(96vw,calc(var(--hero-max-width)*var(--display-scale)))]">
                <div className="hero-promo-rays" aria-hidden="true" style={RAYS_STYLE} />
                <div className="hero-promo-image-shell relative z-10">
                  {promos.map((promo, index) => {
                    if (!renderIndices.has(index)) return null
                    const isActive = index === activeIndex % promos.length
                    return (
                      <img
                        key={promo.id}
                        src={promo.image}
                        srcSet={promo.srcSet}
                        sizes="(max-width: 640px) 92vw, 504px"
                        alt={promo.name}
                        aria-hidden={!isActive || undefined}
                        className={`hero-promo-image absolute inset-0 z-10 block h-full w-full object-contain drop-shadow-[0_30px_50px_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-700 ease-out ${
                          isActive ? "scale-100 opacity-100" : "scale-95 opacity-0"
                        }`}
                        width={1200}
                        height={1200}
                        loading={index === 0 ? "eager" : "lazy"}
                        fetchPriority={index === 0 ? "high" : "low"}
                      />
                    )
                  })}
                </div>
              </div>

              <p className="hero-promo-name pointer-events-none mt-4 inline-flex items-center rounded-full border border-white/20 bg-[#0d3b6e]/85 px-5 py-2 text-base font-semibold text-white shadow-[0_4px_16px_rgba(0,0,0,0.18)] backdrop-blur-md md:mt-8 md:px-6 md:text-lg">
                {title}
              </p>

              <a
                href={ctaUrl}
                className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-white/30 bg-[#0d3b6e] px-5 py-2 text-[0.68rem] font-bold uppercase tracking-[0.18em] text-white transition hover:bg-[#092c55]"
              >
                {dictionary.nav.store}
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="h-[clamp(4.5rem,8vw,11rem)]" />
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-px left-0 z-[1] h-[clamp(4.5rem,8vw,11rem)] w-full"
        role="presentation"
      >
        <path d="M0 132C110 102 216 95 319 100C422 105 517 129 629 136C741 143 853 133 962 118C1071 103 1177 83 1286 81C1346 80 1397 85 1440 92V160H0Z" fill="#fff5d4" />
      </svg>
    </section>
  )
}
