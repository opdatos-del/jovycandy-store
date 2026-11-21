"use client"

import { useEffect, useRef, useState } from "react"

import { CloseIcon, MapPinIcon } from "@/components/icons"
import type { Dictionary, Locale } from "@/lib/i18n"

type LocationDialogProps = {
  locale: Locale
  dictionary: Dictionary
}

export function LocationDialog({ dictionary }: LocationDialogProps) {
  const [open, setOpen] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = "location-dialog-title"

  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener("jovy:location:open", onOpen)
    return () => window.removeEventListener("jovy:location:open", onOpen)
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={() => setOpen(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false)
      }}
      className="m-auto max-h-[92dvh] w-[min(96vw,64rem)] overflow-y-auto rounded-2xl bg-[#fffaf0] p-0 shadow-2xl backdrop:bg-stone-950/55 backdrop:backdrop-blur-sm"
    >
      <section>
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-stone-500">{dictionary.location.subtitle}</p>
            <h2 id={titleId} className="text-2xl font-semibold text-stone-900">{dictionary.location.title}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} aria-label={dictionary.promoBanner.close} className="rounded-full p-2 text-stone-600 transition hover:bg-stone-200">
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[1.4fr_0.8fr]">
          <iframe
            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d571.6109278153666!2d-103.33300968346919!3d20.568203718212708!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x842f4d35d2caa443%3A0x6649964dd802ca39!2sDulces%20Jovy!5e1!3m2!1ses-419!2smx!4v1776429037235!5m2!1ses-419!2smx"
            width="100%"
            height="480"
            style={{ border: 0, display: "block" }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups"
            title={dictionary.location.mapTitle}
            className="w-full rounded-xl border border-stone-200"
          />

          <div className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
            <div className="grid gap-4 p-5 text-sm text-stone-700">
              <div className="flex gap-3">
                <MapPinIcon className="mt-0.5 h-5 w-5 shrink-0 text-stone-400" />
                <div><p className="text-[0.65rem] font-bold uppercase tracking-wider text-stone-500">{dictionary.location.address}</p><p className="mt-1">Dulces Jovy, Guadalajara, México</p></div>
              </div>
              <div><p className="text-[0.65rem] font-bold uppercase tracking-wider text-stone-500">{dictionary.location.phone}</p><p className="mt-1">+52 (33) 3284 1400 EXT 08</p></div>
              <div><p className="text-[0.65rem] font-bold uppercase tracking-wider text-stone-500">{dictionary.location.hours}</p><p className="mt-1">Lunes - Viernes: 9:00 - 18:00</p></div>
              <div><p className="text-[0.65rem] font-bold uppercase tracking-wider text-stone-500">{dictionary.location.email}</p><p className="mt-1">casajovy@jovycandy.com</p></div>
              <p className="text-xs leading-5 text-stone-500">{dictionary.location.visitDescription}</p>
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  window.dispatchEvent(new CustomEvent("jovy:contact:open"))
                }}
                className="mt-2 rounded-full bg-[#0d3b6e] px-5 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white"
              >
                {dictionary.nav.contact}
              </button>
            </div>
          </div>
        </div>
      </section>
    </dialog>
  )
}
