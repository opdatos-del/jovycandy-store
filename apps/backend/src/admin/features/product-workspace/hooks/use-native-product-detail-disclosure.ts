"use client"

import { useEffect, useRef } from "react"

const TECHNICAL_SECTION_TITLES = ["Options", "Metadata", "JSON"]

type Props = {
  compact: boolean
}

function findProductDetailCard(heading: HTMLHeadingElement) {
  const header = heading.parentElement
  const card = header?.parentElement

  if (!header || !card || !card.className.includes("shadow-elevation-card-rest")) return null

  return { card, header }
}

function setCollapsed(card: HTMLElement, collapsed: boolean) {
  const content = card.querySelector<HTMLElement>("[data-jovy-native-section-content]")
  const button = card.querySelector<HTMLButtonElement>("[data-jovy-native-section-toggle]")

  if (!content || !button) return

  content.hidden = collapsed
  button.setAttribute("aria-expanded", String(!collapsed))
  button.textContent = collapsed ? "Mostrar" : "Ocultar"
  button.setAttribute("aria-label", `${collapsed ? "Mostrar" : "Ocultar"} ${card.dataset.jovyNativeSection}`)
}

/**
 * Añade disclosure reversible a los paneles técnicos renderizados por el
 * detalle nativo de Medusa. No altera sus campos ni solicitudes; solo reduce
 * espacio visual para que los widgets editoriales queden antes al alcance.
 */
export const useNativeProductDetailDisclosure = ({ compact }: Props) => {
  const compactRef = useRef(compact)

  useEffect(() => {
    compactRef.current = compact
  }, [compact])

  useEffect(() => {
    const initializedCards: HTMLElement[] = []

    const initialize = () => {
      for (const heading of document.querySelectorAll<HTMLHeadingElement>("h2")) {
        const title = heading.textContent?.trim()
        if (!title || !TECHNICAL_SECTION_TITLES.includes(title)) continue

        const target = findProductDetailCard(heading)
        if (!target || target.card.querySelector("[data-jovy-native-section-content]")) continue

        const sectionId = `jovy-native-section-${title.toLowerCase()}`
        const content = document.createElement("div")
        content.id = sectionId
        content.dataset.jovyNativeSectionContent = ""

        for (const child of [...target.card.children]) {
          if (child !== target.header) content.append(child)
        }
        target.card.append(content)

        const toggle = target.header.querySelector<HTMLButtonElement>("[data-jovy-native-section-toggle]")
        if (!toggle) {
          const nextToggle = document.createElement("button")
          nextToggle.type = "button"
          nextToggle.dataset.jovyNativeSectionToggle = ""
          nextToggle.className =
            "text-ui-fg-interactive hover:bg-ui-bg-base-pressed inline-flex min-h-6 items-center rounded-md px-2 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
          nextToggle.addEventListener("click", () => {
            const currentContent = target.card.querySelector<HTMLElement>("[data-jovy-native-section-content]")
            if (currentContent) setCollapsed(target.card, !currentContent.hidden)
          })
          target.header.append(nextToggle)
        }

        target.card.dataset.jovyNativeSection = title
        target.header
          .querySelector<HTMLButtonElement>("[data-jovy-native-section-toggle]")
          ?.setAttribute("aria-controls", sectionId)
        setCollapsed(target.card, compactRef.current)
        if (!initializedCards.includes(target.card)) initializedCards.push(target.card)
      }
    }

    initialize()
    const observer = new MutationObserver(initialize)
    observer.observe(document.body, { childList: true, subtree: true })

    return () => {
      observer.disconnect()
      for (const card of initializedCards) {
        card.querySelector("[data-jovy-native-section-toggle]")?.remove()
        const content = card.querySelector<HTMLElement>("[data-jovy-native-section-content]")
        if (content) {
          while (content.firstChild) card.append(content.firstChild)
          content.remove()
        }
        delete card.dataset.jovyNativeSection
      }
    }
  }, [])

  useEffect(() => {
    for (const card of document.querySelectorAll<HTMLElement>("[data-jovy-native-section]")) {
      setCollapsed(card, compact)
    }
  }, [compact])
}
