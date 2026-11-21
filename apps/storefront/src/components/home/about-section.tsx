import { HeartIcon, RocketIcon, TargetIcon } from "@/components/icons"
import type { Dictionary } from "@/lib/i18n"

import { AboutValues } from "./about-values"
import { AboutVideo } from "./about-video"
import { SectionWave } from "./section-wave"

type AboutSectionProps = {
  dictionary: Dictionary
}

const VALUE_KEYS = ["trust", "integrity", "responsibility", "innovation", "reliability", "generosity"] as const

const LAYER_ICONS = {
  target: TargetIcon,
  rocket: RocketIcon,
  heart: HeartIcon,
} as const

const LAYER_ACCENTS = {
  target: "bg-[#00AFAA]",
  rocket: "bg-[#ff6b71]",
  heart: "bg-[#f472b6]",
} as const

type LayerIcon = keyof typeof LAYER_ICONS

type AboutLayer = {
  id: string
  icon: LayerIcon
  kicker: string
  title: string
  body: string
  values?: Array<{ title: string; description: string }>
}

export function AboutSection({ dictionary }: AboutSectionProps) {
  const about = dictionary.about

  const layers: AboutLayer[] = [
    {
      id: "mission",
      icon: "target",
      kicker: about.layers.mission.kicker,
      title: about.layers.mission.title,
      body: about.layers.mission.body,
    },
    {
      id: "vision",
      icon: "rocket",
      kicker: about.layers.vision.kicker,
      title: about.layers.vision.title,
      body: about.layers.vision.body,
    },
    {
      id: "values",
      icon: "heart",
      kicker: about.layers.values.kicker,
      title: about.layers.values.title,
      body: "",
      values: VALUE_KEYS.map((value) => ({
        title: about.layers.values.items[value].title,
        description: about.layers.values.items[value].description,
      })),
    },
  ]

  return (
    <section id="nuestra-esencia" className="section-space relative overflow-hidden bg-[#f8ebe6]">
      <div className="page-shell-wide relative z-10">
        <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-start xl:gap-12">
          <div className="relative isolate min-h-[30rem] overflow-hidden rounded-2xl bg-[#f8ebe6] sm:min-h-[44rem] sm:rounded-3xl lg:min-h-[44rem]">
            <AboutVideo />
            <div className="relative z-10 flex h-full items-start px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-16">
              <div className="w-full max-w-[36rem] px-1 py-1 sm:px-2 sm:py-2">
                <h2 className="mb-4 max-w-[16ch] text-4xl font-semibold tracking-[0.03em] text-white [text-shadow:0_10px_30px_rgba(0,0,0,0.35)] sm:mb-5 sm:text-5xl lg:mb-6 lg:text-6xl">
                  {about.titleLines[0]}
                  {about.titleLines[1] ? (
                    <>
                      <br />
                      {about.titleLines[1]}
                    </>
                  ) : null}
                </h2>
                <p className="max-w-[52ch] text-sm leading-[1.95] text-white/90 [text-shadow:0_8px_24px_rgba(0,0,0,0.3)] sm:text-base">
                  {about.description}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1 lg:pt-2">
            <div className="space-y-7 sm:space-y-9 lg:space-y-12">
              {layers.map((layer) => {
                const Icon = LAYER_ICONS[layer.icon]
                return (
                  <div key={layer.id} className="flex items-start gap-4 sm:gap-5 lg:gap-6">
                    <div
                      className={`${LAYER_ACCENTS[layer.icon]} mt-1 flex shrink-0 items-center justify-center rounded-full p-2.5 shadow-[0_6px_14px_rgba(28,25,23,0.10)] sm:p-3`}
                    >
                      <Icon className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                    </div>

                    <div className="min-w-0 flex-1">
                      {layer.kicker ? (
                        <p className="mb-0.5 text-[clamp(0.65rem,1.8vw,0.75rem)] font-semibold uppercase tracking-[0.28em] text-stone-500 lg:text-xs">
                          {layer.kicker}
                        </p>
                      ) : null}

                      <h3 className="mb-1 text-lg font-semibold text-stone-900 sm:text-2xl lg:text-3xl">{layer.title}</h3>

                      {layer.body ? (
                        <p className="max-w-prose text-sm leading-relaxed text-stone-600 lg:text-base">{layer.body}</p>
                      ) : null}

                      {layer.values ? <AboutValues values={layer.values} /> : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      <SectionWave fill="#00AFAA" />
    </section>
  )
}
