"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { CloseIcon, FacebookIcon, InstagramIcon, MenuIcon } from "@/components/icons"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"

type SiteHeaderProps = {
  locale: Locale
  dictionary: Dictionary
}

function openDialog(name: "contact" | "location") {
  window.dispatchEvent(new CustomEvent(`jovy:${name}:open`))
}

export function SiteHeader({ locale, dictionary }: SiteHeaderProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDialogElement>(null)

  const nav = [
    { key: "home", href: `/${locale}` },
    { key: "upcomingEvents", href: `/${locale}#eventos` },
    { key: "store", href: `/${locale}/catalogo` },
    { key: "contact", action: "contact" },
    { key: "location", action: "location" },
  ] as const

  useEffect(() => {
    const dialog = menuRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  const otherLocale = locale === "es" ? "en" : "es"
  const otherPath = pathname.replace(/^\/(es|en)/, `/${otherLocale}`) || `/${otherLocale}`

  const navLabel = (key: (typeof nav)[number]["key"]) =>
    key === "home"
      ? dictionary.nav.home
      : key === "upcomingEvents"
        ? dictionary.nav.upcomingEvents
        : key === "store"
          ? dictionary.nav.store
          : key === "contact"
            ? dictionary.nav.contact
            : dictionary.nav.location

  return (
    <header className={`fixed inset-x-0 top-0 z-40 transition-colors ${open ? "bg-[#edf5ff]" : "bg-transparent"}`}>
      <div className="app-navbar-shell page-shell-wide">
        <div className="app-navbar-inner flex items-center justify-between text-stone-900">
          <Link href={`/${locale}`} aria-label={dictionary.nav.goHome} className="shrink-0">
            <img
              src="/assets/brand/logo/jovy-logo-480.webp"
              srcSet={responsiveSrcSet("/assets/brand/logo/jovy-logo.png", [240, 480])}
              sizes="96px"
              alt="Jovy"
              className="app-navbar-logo w-auto object-contain drop-shadow-[0_8px_18px_rgba(68,54,40,0.12)]"
              width={480}
              height={270}
              loading="eager"
              fetchPriority="high"
              draggable={false}
            />
          </Link>

          <div className="hidden items-center gap-3 lg:flex">
            <nav className="flex items-center gap-2" aria-label={dictionary.nav.home}>
              {nav.map((item) =>
                "href" in item ? (
                  <a
                    key={item.key}
                    href={item.href}
                    className={`inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] shadow-sm transition xl:text-[0.66rem] ${
                      item.key === "upcomingEvents"
                        ? "border border-[#ff5f6d] bg-white/70 text-[#e8465b] hover:bg-white"
                        : "border border-[#0d3b6e]/15 bg-white/70 text-[#0d3b6e] hover:bg-white"
                    }`}
                  >
                    {item.key === "upcomingEvents" ? <span className="h-1.5 w-1.5 rounded-full bg-[#ff5f6d]" /> : null}
                    {navLabel(item.key)}
                  </a>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => openDialog(item.action)}
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[#0d3b6e]/15 bg-white/70 px-4 py-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#0d3b6e] shadow-sm transition hover:bg-white xl:text-[0.66rem]"
                  >
                    {navLabel(item.key)}
                  </button>
                ),
              )}
            </nav>

            <div className="flex items-center gap-2">
              <a
                href="https://www.facebook.com/jovymx/"
                target="_blank"
                rel="noreferrer"
                aria-label="Facebook de Jovy"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/75 text-[#0d3b6e] shadow-sm transition hover:bg-white"
              >
                <FacebookIcon className="h-4 w-4" />
              </a>
              <a
                href="https://www.instagram.com/jovymx"
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram de Jovy"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/75 text-[#0d3b6e] shadow-sm transition hover:bg-white"
              >
                <InstagramIcon className="h-4 w-4" />
              </a>
              <Link
                href={otherPath}
                hrefLang={otherLocale}
                className="ml-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#0d3b6e] shadow-sm"
              >
                <span className="h-3 w-3 rounded-full bg-[linear-gradient(90deg,#006847_33%,#ffffff_33%,#ffffff_66%,#ce1126_66%)]" aria-hidden="true" />
                {locale === "es" ? "ES" : "EN"}
              </Link>
            </div>
          </div>

          <button
            type="button"
            aria-label={open ? dictionary.nav.closeMenu : dictionary.nav.openMenu}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="touch-target flex items-center justify-center rounded-full bg-white/55 p-2 text-[#0d3b6e] lg:hidden"
          >
            {open ? <CloseIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        </div>
      </div>

      <dialog
        ref={menuRef}
        onClose={() => setOpen(false)}
        className="m-0 h-dvh max-h-none w-full max-w-none bg-[#edf5ff] p-0 backdrop:bg-black/30 lg:hidden"
      >
        <div className="flex items-center justify-between px-6 pt-5">
          <Link href={`/${locale}`} aria-label={dictionary.nav.goHome} onClick={() => setOpen(false)}>
            <img src="/assets/brand/logo/jovy-logo-480.webp" srcSet={responsiveSrcSet("/assets/brand/logo/jovy-logo.png", [240, 480])} sizes="96px" alt="Jovy" className="app-navbar-logo w-auto object-contain" width={480} height={270} />
          </Link>
          <button type="button" onClick={() => setOpen(false)} aria-label={dictionary.nav.closeMenu} className="rounded-full bg-white/70 p-3 text-[#0d3b6e]">
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="px-6 pt-8">
          <nav className="flex flex-col gap-5" aria-label={dictionary.nav.home}>
            {nav.map((item) =>
              "href" in item ? (
                <a
                  key={item.key}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="border-b border-[#0d3b6e]/10 pb-4 text-xl font-semibold uppercase tracking-[0.12em] text-[#0d3b6e]"
                >
                  {navLabel(item.key)}
                </a>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    setOpen(false)
                    openDialog(item.action)
                  }}
                  className="border-b border-[#0d3b6e]/10 pb-4 text-left text-xl font-semibold uppercase tracking-[0.12em] text-[#0d3b6e]"
                >
                  {navLabel(item.key)}
                </button>
              ),
            )}
          </nav>
          <div className="mt-8 flex items-center gap-4">
            <a href="https://www.facebook.com/jovymx/" target="_blank" rel="noreferrer" aria-label="Facebook de Jovy" className="text-[#0d3b6e]">
              <FacebookIcon className="h-6 w-6" />
            </a>
            <a href="https://www.instagram.com/jovymx" target="_blank" rel="noreferrer" aria-label="Instagram de Jovy" className="text-[#0d3b6e]">
              <InstagramIcon className="h-6 w-6" />
            </a>
            <Link href={otherPath} hrefLang={otherLocale} className="rounded-full border border-[#0d3b6e]/25 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-[#0d3b6e]">
              {locale === "es" ? "English" : "EspaÃ±ol"}
            </Link>
          </div>
        </div>
      </dialog>
    </header>
  )
}


