import type { NoveltyMediaType } from "./model"

/**
 * Tipos de la API que no forman parte de las reglas puras de `model.ts`.
 * Se mantienen aquí para no duplicar las reglas editoriales de la bandeja.
 */

export type EventType = { id: string; name: string; code: string }

export type UploadedMedia = {
  id: string
  url: string | null
  media_type: NoveltyMediaType
}
