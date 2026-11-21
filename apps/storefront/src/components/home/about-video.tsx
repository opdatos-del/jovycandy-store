"use client"

import { useEffect, useRef } from "react"

export function AboutVideo() {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || typeof IntersectionObserver === "undefined") return

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          void video.play().catch(() => {})
        } else {
          video.pause()
        }
      },
      { rootMargin: "200px" },
    )

    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full object-cover"
      muted
      loop
      playsInline
      preload="none"
      poster="/assets/marketing/about/casa-jovy-1-800.webp"
      aria-hidden="true"
    >
      <source src="/videos/JOVY-CALIDAD.webm" type="video/webm" />
    </video>
  )
}
