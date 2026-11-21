import type { Dictionary } from "@/lib/i18n"
import { SectionWave } from "./section-wave"

type CertificationsProps = {
  dictionary: Dictionary
}

const CERTS = [
  { src: "/assets/certifications/sgs.webp", pdf: "/assets/certifications/mxmex-553119308-certificatefssc-final.pdf", alt: "SGS" },
  { src: "/assets/certifications/kosher-icon.webp", pdf: "/assets/certifications/kosher.pdf", alt: "Kosher" },
  { src: "/assets/certifications/halal.webp", pdf: "/assets/certifications/ih-634-2024-c06-s1-halal.pdf", alt: "Halal" },
]

export function Certifications({ dictionary }: CertificationsProps) {
  const sectionTitle = dictionary.certifications.title

  return (
    <section
      id="certificaciones"
      className="certifications-section relative z-20 overflow-hidden bg-[linear-gradient(180deg,#d61f4d_0%,#c2412d_100%)] pb-28 pt-28 sm:pb-32 sm:pt-32"
      style={{
        paddingTop: "clamp(6rem, 9vw, 10rem)",
        paddingBottom: "clamp(4.5rem, 7vw, 7rem)",
      }}
    >
      <SectionWave fill="#fff5d4" position="top" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[#fff5d4]" />
      <div className="flex justify-center px-4">
        <h2 className="font-mono text-xs uppercase tracking-[0.35em] text-white/80 opacity-90 lg:text-sm">{dictionary.certifications.eyebrow}</h2>
      </div>

      <div className="certifications-layout page-shell-wide grid items-center">
        <div className="certifications-copy flex flex-col">
          {sectionTitle ? <h2 className="certifications-eyebrow mb-6 font-mono text-sm uppercase text-white/75 sm:text-base">{sectionTitle}</h2> : null}
          <h3 className="certifications-title mb-6 font-semibold text-white">{dictionary.certifications.subtitle}</h3>
          <p className="certifications-body max-w-[min(92vw,calc(54rem*var(--content-scale)))] text-justify font-medium leading-relaxed text-white/88">
            {dictionary.certifications.description}
          </p>
        </div>

        <div className="certifications-grid mx-auto grid">
          {CERTS.map((cert) => (
            <a
              key={cert.alt}
              href={cert.pdf}
              target="_blank"
              rel="noreferrer"
              aria-label={dictionary.certifications.viewPdf.replace("{{name}}", cert.alt)}
              className="certification-card group relative flex aspect-square items-center justify-center bg-white p-0.5 shadow-[0_16px_40px_rgba(110,37,54,0.16)] ring-1 ring-black/5 sm:p-1"
            >
              <img src={cert.src} alt={cert.alt} className="relative z-10 h-full w-full object-contain" loading="eager" fetchPriority="high" decoding="sync" />
            </a>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-white/70">{dictionary.certifications.tapHint}</p>
      <SectionWave fill="#ffffff" />
    </section>
  )
}
