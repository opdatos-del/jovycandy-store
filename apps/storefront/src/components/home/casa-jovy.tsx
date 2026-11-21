import { FacebookIcon, InstagramIcon, TikTokIcon } from "@/components/icons"
import type { CmsGalleryItem } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary } from "@/lib/i18n"

type CasaJovyProps = {
  dictionary: Dictionary
  gallery: CmsGalleryItem[]
}

export function CasaJovy({ dictionary, gallery }: CasaJovyProps) {
  const images = gallery.slice(0, 4)
  const socials = [
    { label: dictionary.casa_jovy.instagram_label, handle: dictionary.casa_jovy.instagram_handle, detail: dictionary.casa_jovy.instagram_detail, href: "https://www.instagram.com/CasaJovyMX", Icon: InstagramIcon },
    { label: dictionary.casa_jovy.facebook_label, handle: dictionary.casa_jovy.facebook_handle, detail: dictionary.casa_jovy.facebook_detail, href: "https://www.facebook.com/CasaJovyMX/", Icon: FacebookIcon },
    { label: dictionary.casa_jovy.tiktok_label, handle: dictionary.casa_jovy.tiktok_handle, detail: dictionary.casa_jovy.tiktok_detail, href: "https://www.tiktok.com/@casajovymx", Icon: TikTokIcon },
  ]

  return (
    <section className="tagline-section-bg relative overflow-hidden py-0">
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute left-0 top-0 z-[1] h-[clamp(3.25rem,6vw,6.25rem)] w-full"
        role="presentation"
      >
        <path d="M0 20C110 60 216 75 319 65C422 55 517 20 629 12C741 10 853 20 962 40C1071 60 1177 80 1286 85C1346 85 1397 75 1440 65V0H0Z" fill="#ffffff" />
      </svg>
      <div className="h-[clamp(3.25rem,6vw,6.25rem)]" />

      <div className="relative z-10 w-full">
        <div className="grid lg:min-h-[39rem] lg:grid-cols-[0.95fr_1.1fr_0.95fr]">
          <article className="flex flex-col justify-center border-b border-white/30 px-6 py-10 sm:px-8 md:px-10 lg:min-h-[39rem] lg:border-b-0 lg:border-r lg:px-10 xl:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-white/85">Casa Jovy</p>
            <h2 className="mt-4 max-w-[min(90vw,14ch)] text-4xl font-semibold tracking-[0.03em] text-white sm:text-5xl lg:text-6xl">
              {dictionary.tagline.subtitle}
            </h2>
            <div className="mt-6 max-w-[33rem] space-y-4 text-sm leading-7 text-white/75">
              <p>{dictionary.tagline.description}</p>
            </div>
          </article>

          <article className="flex flex-col justify-center border-b border-white/30 px-6 py-10 sm:px-8 md:px-10 lg:min-h-[39rem] lg:border-b-0 lg:border-r lg:px-10 xl:px-12">
            <div className="flex h-full flex-col justify-center">
              <div className="mb-5">
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-white/85">{dictionary.tagline.gallery}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[0.03em] text-white sm:text-3xl lg:text-4xl">{dictionary.tagline.galleryLabel}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {images.length ? (
                  images.map((item, index) => (
                    <figure key={item.id} className="aspect-square overflow-hidden bg-[#e9d3c4]">
                      <img
                        src={item.image.startsWith("/assets/marketing/about/casa-jovy") ? item.image.replace(/\.webp$/, "-800.webp") : item.image}
                        srcSet={item.image.startsWith("/assets/marketing/about/casa-jovy") ? responsiveSrcSet(item.image, [480, 800]) : undefined}
                        sizes="(max-width: 1024px) 45vw, 25vw"
                        alt={dictionary.tagline.imgAlt.replace("{{index}}", String(index + 1))}
                        className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.04]"
                        width={800}
                        height={533}
                        loading="lazy"
                      />
                    </figure>
                  ))
                ) : (
                  <div className="col-span-2 flex aspect-[2/1] items-center justify-center border border-dashed border-white/35 bg-white/10 px-4 text-center text-sm text-white/70">
                    {dictionary.tagline.noImages}
                  </div>
                )}
              </div>
            </div>
          </article>

          <article className="flex flex-col justify-center px-6 py-10 sm:px-8 md:px-10 lg:min-h-[39rem] lg:px-10 xl:px-12">
            <p className="text-xs font-bold uppercase tracking-[0.34em] text-white/85">{dictionary.tagline.socialTitle}</p>
            <h3 className="mt-4 text-2xl font-semibold tracking-[0.03em] text-white sm:text-3xl lg:text-4xl">{dictionary.tagline.socialSubtitle}</h3>
            <p className="mt-4 text-sm leading-7 text-white/75">{dictionary.tagline.socialDescription}</p>

            <div className="mt-7 space-y-0 border-t border-white/40">
              {socials.map(({ label, handle, detail, href, Icon }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" className="flex items-start gap-4 border-b border-white/40 py-4 transition-colors hover:bg-white/5">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/55 text-white shadow-[0_6px_18px_rgba(101,70,49,0.08)]">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.28em] text-white/85">{label}</p>
                    <p className="mt-1 text-base font-black tracking-[-0.03em] text-white/70">{handle}</p>
                    <p className="mt-1 text-sm leading-6 text-white/75">{detail}</p>
                  </div>
                </a>
              ))}
            </div>
          </article>
        </div>
      </div>

      <div className="h-[clamp(4.5rem,8vw,9rem)]" />
      <svg
        viewBox="0 0 1440 160"
        preserveAspectRatio="none"
        className="pointer-events-none absolute -bottom-px left-0 z-[1] h-[clamp(4.5rem,8vw,9rem)] w-full"
        role="presentation"
      >
        <path d="M0 140C110 100 216 85 319 95C422 105 517 140 629 148C741 150 853 140 962 120C1071 100 1177 80 1286 75C1346 75 1397 85 1440 95V160H0Z" fill="#f8ebe6" />
      </svg>
    </section>
  )
}
