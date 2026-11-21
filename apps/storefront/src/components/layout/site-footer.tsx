"use client"

import Link from "next/link"

import { FacebookIcon, InstagramIcon } from "@/components/icons"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary, Locale } from "@/lib/i18n"

type SiteFooterProps = {
  locale: Locale
  dictionary: Dictionary
}

const INSTAGRAM = [1, 2, 3, 4, 5, 6].map((index) => `/assets/social/instagram/post${index}.jpg`)
const FACEBOOK = [1, 2, 3, 4, 5, 6].map((index) => `/assets/social/facebook/fb${index}.webp`)

export function SiteFooter({ locale, dictionary }: SiteFooterProps) {
  const links = [
    { key: "home", href: `/${locale}` },
    { key: "aboutUs", href: `/${locale}#nuestra-esencia` },
    { key: "store", href: `/${locale}/catalogo` },
    { key: "upcomingEvents", href: `/${locale}#eventos` },
    { key: "certifications", href: `/${locale}#certificaciones` },
  ] as const

  const label = (key: (typeof links)[number]["key"]) =>
    key === "home"
      ? dictionary.nav.home
      : key === "aboutUs"
        ? dictionary.nav.aboutUs
        : key === "store"
          ? dictionary.nav.store
          : key === "upcomingEvents"
            ? dictionary.events.title
            : dictionary.nav.certifications

  return (
    <footer className="app-footer text-white" style={{ backgroundColor: "#00AFAA", backgroundImage: "linear-gradient(to bottom, #00AFAA, #00AFAA)" }}>
      <div className="page-shell">
        <div className="app-footer-logo-section flex flex-wrap items-center justify-center gap-4">
          <img src="/assets/brand/logo/jovy-logo-480.webp" srcSet={responsiveSrcSet("/assets/brand/logo/jovy-logo.png", [240, 480])} sizes="140px" alt="Jovy" className="h-[clamp(4rem,12vw,5.5rem)] w-auto object-contain" width={480} height={270} loading="lazy" />
          <img src="/hechos-para-convivir.webp" alt="Hechos para convivir" className="h-[clamp(5.9rem,16vw,8rem)] w-auto object-contain" width={400} height={400} loading="lazy" />
        </div>

        <nav className="app-footer-nav flex flex-wrap justify-center gap-x-5 gap-y-2" aria-label={dictionary.nav.home}>
          {links.map((link) => (
            <a key={link.key} href={link.href} className="app-footer-nav-link inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-medium transition-colors hover:text-white/75 sm:text-base">
              {label(link.key)}
            </a>
          ))}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("jovy:contact:open"))}
            className="app-footer-nav-link inline-flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-medium transition-colors hover:text-white/75 sm:text-base"
          >
            {dictionary.nav.contact}
          </button>
        </nav>
      </div>

      <div className="page-shell pb-8">
        <section className="social-feed-section">
          <h2 className="social-title">{dictionary.footer.followUs}</h2>
          <div className="social-grid">
            <div className="social-card instagram-card">
              <div className="social-card-header">
                <div className="social-avatar"><InstagramIcon className="h-5 w-5" /></div>
                <div><h3>Instagram</h3><p>{dictionary.footer.latestPosts}</p></div>
              </div>
              <div className="instagram-feed-wrap">
                <div className="instagram-feed-inner">
                  <div className="instagram-profile-bar">
                    <div className="instagram-profile-left">
                      <div className="instagram-profile-photo"><img src="/assets/brand/logo/jovy-logo.png" alt="Instagram Jovy" loading="lazy" /></div>
                      <div className="instagram-profile-info"><h4>Jovy MX</h4><span>@jovymx</span></div>
                    </div>
                    <a className="instagram-follow-btn" href="https://www.instagram.com/jovymx" target="_blank" rel="noreferrer">Seguir</a>
                  </div>
                  <div className="instagram-grid">
                    {INSTAGRAM.map((src, index) => (
                      <a key={src} href="https://www.instagram.com/jovymx" target="_blank" rel="noreferrer" className="instagram-post">
                        <img src={src} alt={dictionary.footer.postAlt.replace("{{index}}", String(index + 1))} width={200} height={250} loading="lazy" />
                      </a>
                    ))}
                  </div>
                  <div className="instagram-footer-link"><a href="https://www.instagram.com/jovymx" target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center">{dictionary.footer.viewProfile}</a></div>
                </div>
              </div>
            </div>

            <div className="social-card facebook-card">
              <div className="social-card-header">
                <div className="social-avatar"><FacebookIcon className="h-5 w-5" /></div>
                <div><h3>Facebook</h3><p>{dictionary.footer.latestUpdates}</p></div>
              </div>
              <div className="facebook-feed-wrap">
                <div className="facebook-feed-inner">
                  <div className="facebook-profile-bar">
                    <div className="facebook-profile-left">
                      <div className="facebook-profile-photo"><img src="/assets/social/facebook/profile.webp" alt="Facebook Jovy" loading="lazy" /></div>
                      <div className="facebook-profile-info"><h4>Jovy MX</h4><span>@jovymx</span></div>
                    </div>
                    <a className="facebook-follow-btn" href="https://www.facebook.com/jovymx/" target="_blank" rel="noreferrer">Seguir</a>
                  </div>
                  <div className="facebook-grid">
                    {FACEBOOK.map((src, index) => (
                      <a key={src} href="https://www.facebook.com/jovymx/" target="_blank" rel="noreferrer" className="facebook-post">
                        <img src={src} alt={dictionary.footer.postAlt.replace("{{index}}", String(index + 1))} width={200} height={250} loading="lazy" />
                      </a>
                    ))}
                  </div>
                  <div className="facebook-footer-link"><a href="https://www.facebook.com/jovymx/" target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center">{dictionary.footer.viewProfile}</a></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="app-footer-bottom mt-8 flex flex-col items-center justify-between gap-4 border-t border-white/20 pt-6 text-xs text-white/70 sm:flex-row">
          <p className="app-footer-copy uppercase">{dictionary.footer.rights}</p>
          <div className="flex flex-wrap justify-center gap-4">
            <a href="/assets/docs/aviso-privacidad-jovy.pdf" target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline-offset-2 hover:underline">{dictionary.nav.policyInocuity}</a>
            <a href="/assets/docs/uso-cookies-jovy.pdf" target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline-offset-2 hover:underline">{dictionary.nav.policyEnvironmental}</a>
            <Link href={`/${locale === "es" ? "en" : "es"}`} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center underline-offset-2 hover:underline">{locale === "es" ? "English" : "EspaÃ±ol"}</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}



