"use client"

import { useSyncExternalStore } from "react"

export type WorkspaceBlock = {
  id: string
  label: string
  dirty: boolean
  saving: boolean
  save: () => boolean | Promise<boolean>
}

export type WorkspaceSaveSummary = {
  saved: string[]
  failed: string[]
}

/** Ejecuta bloques independientes y conserva el resultado de cada persistencia. */
export async function saveWorkspaceBlocks(blocks: WorkspaceBlock[]): Promise<WorkspaceSaveSummary> {
  const summary: WorkspaceSaveSummary = { saved: [], failed: [] }
  for (const block of blocks) {
    if (!block.dirty) continue
    try {
      if (await block.save()) summary.saved.push(block.label)
      else summary.failed.push(block.label)
    } catch {
      summary.failed.push(block.label)
    }
  }
  return summary
}

type Snapshot = Record<string, WorkspaceBlock>

let blocks: Snapshot = {}
let meta: Record<string, string | null> = {}
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function registerWorkspaceBlock(block: WorkspaceBlock) {
  blocks = { ...blocks, [block.id]: block }
  emit()
}

export function unregisterWorkspaceBlock(id: string) {
  if (!blocks[id]) return
  const next = { ...blocks }
  delete next[id]
  blocks = next
  emit()
}

export function setWorkspaceMeta(key: string, value: string | null) {
  if (meta[key] === value) return
  meta = { ...meta, [key]: value }
  emit()
}

export function useWorkspaceMeta() {
  return useSyncExternalStore(subscribe, () => meta, () => meta)
}

export function useWorkspace() {
  const snapshot = useSyncExternalStore(subscribe, () => blocks, () => blocks)
  const list = Object.values(snapshot)
  return {
    blocks: list,
    dirty: list.filter((block) => block.dirty),
    saving: list.some((block) => block.saving),
    saveAll: () => saveWorkspaceBlocks(list),
  }
}
