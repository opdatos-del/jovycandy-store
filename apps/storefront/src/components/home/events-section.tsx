import type { HomeContent } from "@/lib/cms/client"
import { responsiveSrcSet } from "@/lib/images"
import type { Dictionary } from "@/lib/i18n"
import { SectionWave } from "./section-wave"

type EventsSectionProps = {
  content: HomeContent
  dictionary: Dictionary
}

export function EventsSection({ content, dictionary }: EventsSectionProps) {
  const events = content.events.slice(0, 8)

  return (
    <section
      id="eventos"
      className="events-section relative overflow-hidden pb-28 pt-14 sm:pb-32 sm:pt-20"
      style={{ backgroundImage: "linear-gradient(180deg, #fff5d4 0%, #fff8e0 50%, #fff5d4 100%)" }}
    >
      <div className="relative z-10">
        <div className="events-section-header mx-auto flex max-w-full flex-col items-center gap-3 px-4 text-center sm:gap-4 sm:px-6 md:px-7 lg:px-8">
          <div className="flex flex-col items-center">
            <h2 className="text-4xl font-semibold tracking-[0.03em] text-stone-800 md:text-5xl lg:text-6xl">{dictionary.events.title}</h2>
            <p className="mt-1 text-base font-light tracking-wide text-stone-500 md:text-lg lg:text-xl">{dictionary.events.swipeHint}</p>
          </div>
        </div>

        <div className="events-viewport mobile-scroll relative mt-6 overflow-x-auto overflow-y-visible px-4 pb-4 sm:px-6 md:px-7 lg:px-8 xl:px-10 2xl:px-12">
          <div className="events-track flex w-max min-w-full snap-x snap-mandatory flex-nowrap items-start gap-4 pr-4 sm:gap-5 sm:pr-5 md:gap-6 md:pr-6 lg:gap-7 lg:pr-8 xl:gap-8 xl:pr-10 2xl:gap-9 2xl:pr-12">
            {events.map((event) => (
              <div
                key={event.id}
                className="w-[clamp(17rem,84vw,19rem)] flex-shrink-0 snap-start sm:w-[clamp(17rem,74vw,20rem)] md:w-[clamp(18rem,42vw,21rem)] lg:w-[clamp(19rem,28vw,23rem)] xl:w-[clamp(20rem,24vw,24rem)] 2xl:w-[clamp(21rem,22vw,25rem)]"
              >
                <article className="events-card group relative flex h-full w-full overflow-hidden rounded-[1.4rem] border border-white/70 bg-[linear-gradient(180deg,rgba(255,252,245,0.98),rgba(255,244,219,0.94))] p-2 text-left shadow-[0_18px_44px_rgba(79,54,26,0.12)] transition-shadow duration-300 hover:shadow-[0_24px_56px_rgba(79,54,26,0.18)] sm:rounded-[1.6rem] sm:p-2.5 md:rounded-[1.75rem] md:p-3 lg:rounded-[1.9rem]">
                  <div className="relative w-full overflow-hidden rounded-[1.1rem] bg-white/80 sm:rounded-[1.25rem] md:rounded-[1.35rem] lg:rounded-[1.45rem]">
                    {event.image ? (
                      <img
                        src={event.image.startsWith("/assets/marketing/events/") ? event.image.replace(/\.webp$/, "-720.webp") : event.image}
                        srcSet={event.image.startsWith("/assets/marketing/events/") ? responsiveSrcSet(event.image, [480, 720, 960]) : undefined}
                        sizes="(max-width: 640px) 84vw, (max-width: 1024px) 42vw, 23rem"
                        alt={event.title}
                        className="events-card-media aspect-[3/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                        width={720}
                        height={1200}
                        loading="lazy"
                        fetchPriority="low"
                        decoding="async"
                      />
                    ) : null}
                    <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),transparent_30%,rgba(0,0,0,0.1)_100%)]" />
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SectionWave fill="#d61f4d" />
    </section>
  )
}
