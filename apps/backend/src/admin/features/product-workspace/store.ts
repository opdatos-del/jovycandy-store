"use client"

import { useSyncExternalStore } from "react"

/**
 * Estado compartido por widgets que viven en árboles React distintos dentro del
 * detalle de producto. Permite una barra única con "sin guardar" y guardar todo
 * sin reescribir el Admin nativo.
 */
export type WorkspaceBlock = {
  id: string
  label: string
  dirty: boolean
  saving: boolean
  save: () => void | Promise<void>
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

export function updateWorkspaceBlock(id: string, patch: Partial<Omit<WorkspaceBlock, "id">>) {
  const current = blocks[id]
  if (!current) return
  blocks = { ...blocks, [id]: { ...current, ...patch } }
  emit()
}

export function unregisterWorkspaceBlock(id: string) {
  if (!blocks[id]) return
  const next = { ...blocks }
  delete next[id]
  blocks = next
  emit()
}

export function getWorkspaceSnapshot(): Snapshot {
  return blocks
}

export function setWorkspaceMeta(key: string, value: string | null) {
  if (meta[key] === value) return
  meta = { ...meta, [key]: value }
  emit()
}

function getMetaSnapshot() {
  return meta
}

export function useWorkspaceMeta() {
  return useSyncExternalStore(subscribe, getMetaSnapshot, getMetaSnapshot)
}

export function useWorkspace() {
  const snapshot = useSyncExternalStore(subscribe, getWorkspaceSnapshot, getWorkspaceSnapshot)
  const list = Object.values(snapshot)
  return {
    blocks: list,
    dirty: list.filter((block) => block.dirty),
    saving: list.some((block) => block.saving),
    saveAll: async () => {
      for (const block of list) {
        if (!block.dirty) continue
        await block.save()
      }
    },
  }
}
