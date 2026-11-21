"use client"

import { useEffect, useRef, useState, useSyncExternalStore } from "react"

import { responsiveSrcSet } from "@/lib/images"

const TOTAL_FRAMES = 60
const FRAMES = Array.from({ length: TOTAL_FRAMES }, (_, index) => {
  const number = String(index + 1).padStart(2, "0")
  return `/assets/marketing/frames/logo/frame-${number}.webp`
})

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}

function getReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches
}

export function ScrollLogo() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imagesRef = useRef<Array<HTMLImageElement | null>>([])
  const frameRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const loadingAllRef = useRef(false)
  const [ready, setReady] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [completed, setCompleted] = useState(false)
  const reducedMotion = useSyncExternalStore(subscribeReducedMotion, getReducedMotion, () => false)

  useEffect(() => {
    let cancelled = false

    const loadFrame = (index: number) =>
      new Promise<HTMLImageElement | null>((resolve) => {
        const image = new Image()
        image.decoding = "async"
        image.onload = () => {
          imagesRef.current[index] = image
          resolve(image)
        }
        image.onerror = () => resolve(null)
        image.src = FRAMES[index]
      })

    const loadAll = () => {
      if (cancelled || loadingAllRef.current) return
      loadingAllRef.current = true
      for (let index = 6; index < TOTAL_FRAMES; index += 1) {
        void loadFrame(index)
      }
    }

    const start = async () => {
      await loadFrame(0)
      if (cancelled) return
      setReady(true)
      // Solo los primeros frames entran en la ruta crítica; el resto se
      // carga al primer scroll o tras 3 s para no competir con el LCP.
      for (let index = 1; index < 6; index += 1) {
        void loadFrame(index)
      }
    }

    void start()
    window.addEventListener("scroll", loadAll, { once: true, passive: true })
    const timer = window.setTimeout(loadAll, 3000)

    return () => {
      cancelled = true
      window.removeEventListener("scroll", loadAll)
      window.clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    const onScroll = () => setAnimate(true)
    window.addEventListener("scroll", onScroll, { once: true, passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  useEffect(() => {
    if (!animate || !ready || reducedMotion) return
    const section = sectionRef.current
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!section || !stage || !canvas) return

    const draw = (index: number) => {
      let image = imagesRef.current[index]
      if (!image) {
        for (let fallback = index; fallback >= 0; fallback -= 1) {
          if (imagesRef.current[fallback]) {
            image = imagesRef.current[fallback]
            break
          }
        }
      }
      if (!image) return
      const rect = stage.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(rect.width * dpr))
      const height = Math.max(1, Math.round(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      const context = canvas.getContext("2d")
      if (!context) return
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.imageSmoothingEnabled = true
      const scale = Math.min(rect.width / image.naturalWidth, rect.height / image.naturalHeight)
      const drawWidth = image.naturalWidth * scale
      const drawHeight = image.naturalHeight * scale
      context.drawImage(image, (rect.width - drawWidth) / 2, (rect.height - drawHeight) / 2, drawWidth, drawHeight)
    }

    const update = () => {
      rafRef.current = null
      const rect = section.getBoundingClientRect()
      const scrollable = Math.max(1, section.offsetHeight - window.innerHeight)
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable))
      const index = Math.min(TOTAL_FRAMES - 1, Math.round(progress * (TOTAL_FRAMES - 1)))
      // El claim se revela como cierre de la interacción: cuando la animación
      // de frames llega al final del recorrido sticky.
      if (progress >= 0.97) setCompleted(true)
      else setCompleted(false)
      if (index !== frameRef.current) {
        frameRef.current = index
        draw(index)
      }
    }

    const schedule = () => {
      if (rafRef.current !== null) return
      rafRef.current = window.requestAnimationFrame(update)
    }

    draw(0)
    update()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
    }
  }, [animate, ready, reducedMotion])

  return (
    <section ref={sectionRef} className="relative h-[150svh] bg-[#edf5ff]" aria-label="Animación del logo Jovy">
      <div className="sticky top-0 flex h-[100svh] flex-col items-center justify-center overflow-hidden pt-20">
        <div ref={stageRef} className="relative flex h-[64svh] w-[min(92vw,52rem)] items-center justify-center">
          <img
            src="/assets/marketing/frames/logo/frame-01.webp"
            alt=""
            aria-hidden="true"
            className={`absolute inset-0 h-full w-full object-contain mix-blend-multiply ${!animate && !reducedMotion ? "opacity-100" : "opacity-0"}`}
            width={1280}
            height={720}
            fetchPriority="high"
          />
          {reducedMotion ? (
            <img
              src="/assets/marketing/frames/logo/frame-60.webp"
              alt="Jovy"
              className="relative h-full w-full object-contain mix-blend-multiply"
              width={1280}
              height={720}
            />
          ) : animate ? (
            <canvas
              ref={canvasRef}
              className="relative h-full w-full mix-blend-multiply"
              role="img"
              aria-label="Animación del logo Jovy con ositos de goma"
            />
          ) : null}
        </div>
        <img
          src="/brand/hero/es-tu-mejor-seleccion-800.webp"
          srcSet={responsiveSrcSet("/brand/hero/es-tu-mejor-seleccion.webp", [480, 800])}
          sizes="(max-width: 640px) 62vw, 30rem"
          alt="Es tu mejor selección"
          className={`mt-1 w-[min(62vw,30rem)] object-contain mix-blend-multiply transition-[opacity,transform] duration-700 ease-out sm:mt-3 ${
            reducedMotion || completed ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
          width={800}
          height={200}
          aria-hidden={!reducedMotion && !completed || undefined}
        />
      </div>
    </section>
  )
}
