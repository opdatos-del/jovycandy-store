import {
  draftPayload,
  emptyFilters,
  filterNovelties,
  isValidSlug,
  mediaLaneForFile,
  noveltyStoreState,
  publishIssues,
  type NoveltyEvent,
} from "../model"

const base = (patch: Partial<NoveltyEvent> = {}): NoveltyEvent => ({
  id: "jevtt_1",
  title: "Novedad DEMO",
  title_en: "Demo novelty",
  slug: "novedad-demo",
  description: "Descripción",
  status: "published",
  enabled: true,
  priority: 0,
  sort_order: 0,
  starts_at: "2026-01-15T10:00:00.000Z",
  ends_at: "2026-01-15T14:00:00.000Z",
  event_type_id: "jevtt_type",
  media_file_id: "file_1",
  media_url: "/static/novelty.webm",
  media_type: "video",
  ...patch,
})

const now = new Date("2026-01-15T12:00:00.000Z")

describe("estado real de una novedad en el carrusel", () => {
  it("sólo la marca visible cuando está publicada, activa, vigente y con multimedia", () => {
    expect(noveltyStoreState(base(), now)).toEqual({ visible: true, reason: "Visible en el carrusel" })
  })

  it("nombra el motivo cuando no se muestra y nunca la presenta como publicada", () => {
    expect(noveltyStoreState(base({ status: "draft" }), now)).toMatchObject({ visible: false })
    expect(noveltyStoreState(base({ status: "archived" }), now).reason).toContain("Archivada")
    expect(noveltyStoreState(base({ status: "cancelled" }), now).reason).toContain("Cancelada")
    expect(noveltyStoreState(base({ enabled: false }), now).reason).toContain("Inactiva")
    expect(noveltyStoreState(base({ starts_at: "2026-01-15T13:00:00.000Z" }), now).reason).toContain("Programada")
    expect(noveltyStoreState(base({ ends_at: "2026-01-15T11:00:00.000Z" }), now).reason).toContain(
      "Ventana finalizada",
    )
    expect(noveltyStoreState(base({ media_file_id: null, media_url: null, media_type: null }), now)).toEqual({
      visible: false,
      reason: "Sin multimedia: el carrusel la omite",
    })
  })
})

describe("requisitos de publicación alineados con el backend", () => {
  it("enumera los campos faltantes sin aceptar un estado publicado incompleto", () => {
    expect(publishIssues(base())).toEqual([])
    expect(
      publishIssues({
        title: "",
        title_en: null,
        event_type_id: null,
        starts_at: null,
        ends_at: null,
      }),
    ).toEqual(["título en español", "título en inglés", "tipo de evento", "fecha de inicio"])
  })

  it("exige que el fin sea posterior al inicio", () => {
    expect(
      publishIssues(base({ starts_at: "2026-01-15T12:00:00.000Z", ends_at: "2026-01-15T12:00:00.000Z" })),
    ).toEqual(["rango de fechas coherente"])
  })
})

describe("filtros de la bandeja", () => {
  const events = [
    base({ id: "a", title: "Lanzamiento de temporada", title_en: "Season launch" }),
    base({ id: "b", title: "Feria de dulces", status: "draft", enabled: false, media_file_id: null, media_url: null, media_type: null }),
    base({ id: "c", title: "Galería GIF", media_type: "gif", media_file_id: "file_gif", media_url: "/static/x.gif" }),
  ]

  it("busca por título, título EN y slug sin distinguir acentos ni mayúsculas", () => {
    expect(filterNovelties(events, { ...emptyFilters(), search: "GALERIA" }).map((event) => event.id)).toEqual(["c"])
    expect(filterNovelties(events, { ...emptyFilters(), search: "season" }).map((event) => event.id)).toEqual(["a"])
    expect(filterNovelties(events, { ...emptyFilters(), search: "novedad-demo" }).map((event) => event.id)).toEqual([
      "a",
      "b",
      "c",
    ])
  })

  it("combina estado, tipo de medio y actividad sin reordenar", () => {
    expect(filterNovelties(events, { ...emptyFilters(), status: "draft" }).map((event) => event.id)).toEqual(["b"])
    expect(filterNovelties(events, { ...emptyFilters(), media: "gif" }).map((event) => event.id)).toEqual(["c"])
    expect(filterNovelties(events, { ...emptyFilters(), media: "none" }).map((event) => event.id)).toEqual(["b"])
    expect(filterNovelties(events, { ...emptyFilters(), active: "no" }).map((event) => event.id)).toEqual(["b"])
    expect(
      filterNovelties(events, { ...emptyFilters(), status: "published", active: "yes", media: "video" }).map(
        (event) => event.id,
      ),
    ).toEqual(["a"])
  })
})

describe("carriles de carga y payload", () => {
  it("valida el slug con la misma forma que el backend", () => {
    expect(isValidSlug("novedad-demo")).toBe(true)
    expect(isValidSlug("a")).toBe(false)
    expect(isValidSlug("Novedad Demo")).toBe(false)
    expect(isValidSlug("novedad--demo")).toBe(false)
  })

  it("manda imágenes al carril de 5 MB y GIF/vídeo al de 100 MB", () => {
    expect(mediaLaneForFile({ type: "image/png" })).toBe("image")
    expect(mediaLaneForFile({ type: "image/webp" })).toBe("image")
    expect(mediaLaneForFile({ type: "image/gif" })).toBe("video")
    expect(mediaLaneForFile({ type: "video/webm" })).toBe("video")
    expect(mediaLaneForFile({ type: "image/svg+xml" })).toBeNull()
  })

  it("normaliza el payload sin inventar campos editoriales", () => {
    expect(
      draftPayload({
        title: "  Novedad  ",
        title_en: "  ",
        slug: " novedad-demo ",
        description: "  ",
        status: "draft",
        enabled: true,
        priority: 3,
        sort_order: 2,
        starts_at: null,
        ends_at: null,
        event_type_id: null,
        media_file_id: null,
        media_url: null,
        media_type: null,
      }),
    ).toEqual({
      title: "Novedad",
      title_en: null,
      slug: "novedad-demo",
      description: null,
      status: "draft",
      enabled: true,
      priority: 3,
      sort_order: 2,
      starts_at: null,
      ends_at: null,
      event_type_id: null,
      media_file_id: null,
    })
  })
})
