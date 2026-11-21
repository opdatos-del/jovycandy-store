import type { Dictionary } from "@/lib/i18n"
import { AboutVideo } from "./about-video"
import { SectionWave } from "./section-wave"

type AboutSectionProps = {
  dictionary: Dictionary
}

const VALUE_KEYS = ["trust", "integrity", "responsibility", "innovation", "reliability", "generosity"] as const

export function AboutSection({ dictionary }: AboutSectionProps) {
  const about = dictionary.about

  return (
    <section id="nuestra-esencia" className="relative overflow-hidden bg-[#f8ebe6] pb-28 pt-16 sm:pb-32 sm:pt-24">
      <div className="page-shell-wide relative z-10">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="relative isolate min-h-[30rem] overflow-hidden rounded-2xl bg-[#f8ebe6] sm:min-h-[38rem] sm:rounded-3xl">
            <AboutVideo />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/55 via-stone-950/10 to-transparent" />
            <div className="relative z-10 flex h-full flex-col justify-end p-6 text-white sm:p-10">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.3em] text-[#ffd166]">Jovy Candy</p>
              <h2 className="mt-3 text-4xl font-black uppercase leading-[0.95] sm:text-5xl">
                {about.titleLines[0]}<br />{about.titleLines[1]}
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-white/85 sm:text-base">{about.description}</p>
            </div>
          </div>

          <div className="grid gap-4">
            {(["mission", "vision"] as const).map((key) => {
              const layer = about.layers[key]
              return (
                <article key={key} className="rounded-2xl border border-stone-200 bg-white/75 p-6 shadow-sm">
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[#b4234a]">{layer.detail}</p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[0.02em] text-[#0d3b6e]">{layer.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-stone-600">{layer.body}</p>
                </article>
              )
            })}

            <article className="rounded-2xl border border-stone-200 bg-[#0d3b6e] p-6 text-white shadow-sm">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.26em] text-[#ffd166]">{about.layers.values.detail}</p>
                  <h3 className="mt-2 text-2xl font-black uppercase tracking-[0.02em]">{about.layers.values.title}</h3>
                </div>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {VALUE_KEYS.map((value) => (
                  <div key={value} className="rounded-xl bg-white/10 p-3">
                    <p className="text-sm font-bold">{about.layers.values.items[value].title}</p>
                    <p className="mt-1 text-xs leading-5 text-white/75">{about.layers.values.items[value].description}</p>
                  </div>
                ))}
              </div>
            </article>
          </div>
        </div>
      </div>
      <SectionWave fill="#00AFAA" />
    </section>
  )
}

