import { Photo, Trash } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text } from "@medusajs/ui"
import { useEffect, useRef, useState } from "react"
import { GALLERY_ACCEPT, galleryErrorMessage, validateGalleryImage } from "./gallery-api"

type EntryStatus = "ready" | "uploading" | "created" | "error" | "invalid"

type UploadEntry = {
  id: string
  file: File
  previewUrl: string
  status: EntryStatus
  message?: string
}

type Props = {
  /** Elementos publicados y activos en este instante; el cupo del backend es 4. */
  visibleNow: number
  draftCount: number
  /** Confirmación Medusa (`usePrompt`) antes de iniciar la carga secuencial. */
  onConfirm: (count: number) => Promise<boolean>
  /** Sube un archivo y crea su borrador; lanza un error legible si falla. */
  onUploadOne: (file: File) => Promise<void>
  /** Recarga la lista al terminar al menos una creación. */
  onComplete: () => Promise<void>
}

const statusLabel: Record<EntryStatus, string> = {
  ready: "Pendiente",
  uploading: "Subiendo…",
  created: "Creada",
  error: "Error",
  invalid: "Revisar archivo",
}

const statusColor = (status: EntryStatus): "grey" | "blue" | "green" | "red" | "orange" =>
  status === "created" ? "green"
    : status === "uploading" ? "blue"
      : status === "error" ? "red"
        : status === "invalid" ? "orange"
          : "grey"

export const GalleryUpload = ({ visibleNow, draftCount, onConfirm, onUploadOne, onComplete }: Props) => {
  const [entries, setEntries] = useState<UploadEntry[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const requestInput = useRef<HTMLInputElement>(null)
  const objectUrls = useRef(new Set<string>())

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url))
  }, [])

  const addFiles = (list: FileList | File[] | null) => {
    const files = Array.from(list ?? [])
    if (!files.length) return
    const next = files.map<UploadEntry>((file) => {
      const previewUrl = URL.createObjectURL(file)
      objectUrls.current.add(previewUrl)
      const validation = validateGalleryImage(file)
      return {
        id: crypto.randomUUID(),
        file,
        previewUrl,
        status: validation ? "invalid" : "ready",
        message: validation ?? undefined,
      }
    })
    setEntries((current) => [...current, ...next])
    const invalid = next.filter((entry) => entry.status === "invalid").length
    setAnnouncement(
      invalid
        ? `${next.length - invalid} archivos listos; ${invalid} requieren revisión.`
        : `${next.length} archivos listos para subir.`,
    )
  }

  const removeEntry = (entry: UploadEntry) => {
    if (entry.status === "uploading") return
    URL.revokeObjectURL(entry.previewUrl)
    objectUrls.current.delete(entry.previewUrl)
    setEntries((current) => current.filter((item) => item.id !== entry.id))
  }

  const clearEntries = () => {
    if (busy) return
    entries.forEach((entry) => {
      URL.revokeObjectURL(entry.previewUrl)
      objectUrls.current.delete(entry.previewUrl)
    })
    setEntries([])
    setAnnouncement("")
  }

  const pending = entries.filter((entry) => entry.status === "ready" || entry.status === "error")

  const upload = async () => {
    if (busy) return
    const targets = entries.filter((entry) => entry.status === "ready" || entry.status === "error")
    if (!targets.length) return

    const confirmed = await onConfirm(targets.length)
    if (!confirmed) {
      requestInput.current?.focus()
      return
    }

    setBusy(true)
    let created = 0
    let failed = 0
    setAnnouncement(`Subiendo ${targets.length} ${targets.length === 1 ? "imagen" : "imágenes"}…`)

    for (const entry of targets) {
      setEntries((current) => current.map((item) =>
        item.id === entry.id ? { ...item, status: "uploading", message: undefined } : item))
      try {
        await onUploadOne(entry.file)
        created += 1
        setEntries((current) => current.map((item) =>
          item.id === entry.id ? { ...item, status: "created", message: undefined } : item))
      } catch (error) {
        failed += 1
        const message = galleryErrorMessage(error, "No se pudo subir la imagen.")
        setEntries((current) => current.map((item) =>
          item.id === entry.id ? { ...item, status: "error", message } : item))
        setAnnouncement(`Error en ${entry.file.name}: ${message}`)
      }
    }

    if (created > 0) await onComplete()
    setAnnouncement(
      failed > 0
        ? `${created} ${created === 1 ? "imagen creada" : "imágenes creadas"}; ${failed} con error.`
        : `${created} ${created === 1 ? "imagen creada" : "imágenes creadas"} como borrador.`,
    )
    setBusy(false)
  }

  const hasSelection = entries.length > 0

  return <Container className="p-6" data-testid="gallery-upload-panel">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <Heading level="h2">Cargar imágenes</Heading>
        <Text size="small" className="text-ui-fg-subtle mt-1">
          Selecciona una o varias. Cada archivo se sube de forma secuencial y se crea como borrador;
          no ocupa el cupo de cuatro hasta que lo publiques.
        </Text>
      </div>
      <Badge color="blue">PNG, JPEG o WebP · 5 MB por archivo</Badge>
    </div>

    <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="gallery-upload-quota">
      <Badge color={visibleNow >= 4 ? "orange" : "green"}>Visibles ahora: {visibleNow} de 4</Badge>
      <Badge color="grey">Borradores: {draftCount}</Badge>
      <Text size="xsmall" className="text-ui-fg-subtle">
        Cuatro es el máximo simultáneo publicado, no el total de filas.
      </Text>
    </div>

    <div
      className={`mt-4 rounded-lg border border-dashed p-4 transition-colors ${
        dragging ? "border-ui-border-interactive bg-ui-bg-component" : "border-ui-border-base bg-ui-bg-subtle"
      }`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        addFiles(event.dataTransfer.files)
      }}
    >
      <div className="flex flex-col items-center gap-3 px-2 py-6 text-center">
        <span className="bg-ui-bg-base text-ui-fg-subtle flex h-11 w-11 items-center justify-center rounded-full">
          <Photo />
        </span>
        <div>
          <Text weight="plus">Arrastra imágenes aquí o selecciónalas desde tu equipo</Text>
          <Text size="small" className="text-ui-fg-subtle mt-1">
            Si eliges varias, se cargan una por una con su propio estado.
          </Text>
        </div>
        <label className="border-ui-border-base bg-ui-bg-base text-ui-fg-base hover:bg-ui-bg-subtle focus-within:ring-ui-border-interactive inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium focus-within:ring-2 focus-within:ring-offset-1">
          Seleccionar imágenes
          <input
            ref={requestInput}
            id="gallery-file-input"
            type="file"
            multiple
            accept={GALLERY_ACCEPT}
            aria-label="Archivos de galería"
            className="sr-only"
            onChange={(event) => {
              addFiles(event.target.files)
              event.target.value = ""
            }}
          />
        </label>
      </div>
    </div>

    {hasSelection && <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Text size="small" weight="plus">
          {entries.length} {entries.length === 1 ? "archivo seleccionado" : "archivos seleccionados"}
        </Text>
        <Button size="small" variant="secondary" onClick={clearEntries} disabled={busy}>
          Limpiar lista
        </Button>
      </div>
      <ul className="flex flex-col gap-2" aria-label="Archivos seleccionados">
        {entries.map((entry) => <li
          key={entry.id}
          className="border-ui-border-base flex flex-wrap items-center gap-3 rounded-md border p-2"
          data-testid="gallery-upload-entry"
        >
          <img
            src={entry.previewUrl}
            alt={`Vista previa de ${entry.file.name}`}
            className="bg-ui-bg-subtle h-14 w-14 rounded object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.file.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Badge color={statusColor(entry.status)}>{statusLabel[entry.status]}</Badge>
              {entry.message && <span className="text-ui-fg-error text-xs">{entry.message}</span>}
            </div>
          </div>
          <Button
            size="small"
            variant="transparent"
            onClick={() => removeEntry(entry)}
            disabled={busy || entry.status === "uploading"}
            aria-label={`Quitar ${entry.file.name}`}
          >
            <Trash /> Quitar
          </Button>
        </li>)}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={() => void upload()}
          isLoading={busy}
          disabled={pending.length === 0}
        >
          {pending.length > 0
            ? `Subir ${pending.length} ${pending.length === 1 ? "imagen" : "imágenes"}`
            : "Subir imágenes"}
        </Button>
        <Text size="small" className="text-ui-fg-subtle">
          Las imágenes subidas quedan en borrador en la lista inferior.
        </Text>
      </div>
    </div>}

    <p role="status" aria-live="polite" className="text-ui-fg-subtle mt-3 min-h-5 text-sm">
      {announcement}
    </p>
  </Container>
}
