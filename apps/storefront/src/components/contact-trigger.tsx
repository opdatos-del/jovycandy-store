"use client"

import type { ReactNode } from "react"

type ContactTriggerProps = {
  children: ReactNode
  className?: string
}

export function ContactTrigger({ children, className }: ContactTriggerProps) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent("jovy:contact:open"))}
      className={className}
    >
      {children}
    </button>
  )
}
