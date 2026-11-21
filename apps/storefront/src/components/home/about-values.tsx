"use client"

import { useState } from "react"

import { ChevronDownIcon } from "@/components/icons"

type AboutValuesProps = {
  values: Array<{ title: string; description: string }>
}

export function AboutValues({ values }: AboutValuesProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <>
      {/* Móvil y tablet: acordeón de dos columnas, como el sitio histórico. */}
      <div className="mt-4 grid grid-cols-2 gap-x-3 sm:mt-5 lg:hidden">
        {values.map((value, index) => {
          const isOpen = openIndex === index
          return (
            <div key={value.title} className="border-b border-stone-200/60">
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex min-h-[44px] w-full items-center justify-between gap-2 py-2 text-left"
              >
                <span className="text-sm font-semibold text-stone-900 sm:text-base">{value.title}</span>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-stone-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="pb-2 text-xs leading-relaxed text-stone-500 sm:text-sm">{value.description}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Escritorio: tres columnas estáticas. */}
      <div className="mt-4 hidden gap-x-5 gap-y-3 sm:mt-5 lg:grid lg:grid-cols-3">
        {values.map((value) => (
          <div key={value.title} className="border-b border-stone-200/60 pb-2">
            <p className="text-sm font-semibold text-stone-900 sm:text-base">{value.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-stone-500 sm:text-sm">{value.description}</p>
          </div>
        ))}
      </div>
    </>
  )
}
