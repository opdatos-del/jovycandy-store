import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

import { saveEventWorkflow } from "@jovy/workflows/jovy-events/event"
import { saveBannerWorkflow } from "@jovy/workflows/jovy-marketing/banner"
import { saveHeroWorkflow } from "@jovy/workflows/jovy-marketing/hero"

import { PUT as updateBanner } from "../marketing/banners/[id]/route"
import { PUT as updateHero } from "../marketing/hero/[id]/route"
import { PUT as updateEvent } from "../events/[id]/route"

jest.mock("@jovy/workflows/jovy-events/event", () => ({
  saveEventWorkflow: jest.fn(),
  deleteEventWorkflow: jest.fn(),
}))
jest.mock("@jovy/workflows/jovy-marketing/hero", () => ({
  saveHeroWorkflow: jest.fn(),
  deleteHeroWorkflow: jest.fn(),
}))
jest.mock("@jovy/workflows/jovy-marketing/banner", () => ({
  saveBannerWorkflow: jest.fn(),
  deleteBannerWorkflow: jest.fn(),
}))

type FakeResponse = {
  statusCode: number
  body: unknown
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
  send: () => FakeResponse
}

function fakeResponse(): FakeResponse {
  const response: FakeResponse = {
    statusCode: 200,
    body: undefined,
    status(code) {
      response.statusCode = code
      return response
    },
    json(body) {
      response.body = body
      return response
    },
    send() {
      return response
    },
  }
  return response
}

const eventRow = {
  id: "evt_1",
  title: "Evento",
  title_en: "Event",
  slug: "evento",
  description: null,
  content: null,
  media_file_id: null,
  status: "draft",
  enabled: true,
  priority: 0,
  sort_order: 0,
  event_type_id: null,
  starts_at: new Date("2026-12-01T10:00:00.000Z"),
  ends_at: new Date("2026-12-01T12:00:00.000Z"),
  created_at: new Date("2026-11-01T00:00:00.000Z"),
  updated_at: new Date("2026-11-01T00:00:00.000Z"),
  deleted_at: null,
}

const heroRow = {
  id: "hero_1",
  translations: { es: { title: "Hero" }, en: { title: "Hero EN" } },
  status: "draft",
  enabled: true,
  sort_order: 0,
  background_color: null,
  media_file_id: null,
  cta_url: null,
  starts_at: new Date("2026-12-01T10:00:00.000Z"),
  ends_at: new Date("2026-12-01T12:00:00.000Z"),
  product_id: null,
}

const bannerRow = {
  id: "ban_1",
  slot: "promo",
  translations: {
    es: { title: "Promo", alt: "Promo" },
    en: { title: "Promo EN", alt: "Promo EN" },
  },
  status: "draft",
  enabled: true,
  auto_open: false,
  frequency: "every",
  priority: 0,
  sort_order: 0,
  media_file_id: null,
  cta_url: null,
  starts_at: new Date("2026-12-01T10:00:00.000Z"),
  ends_at: new Date("2026-12-01T12:00:00.000Z"),
}

function fakeRequest(row: Record<string, unknown>, body: unknown) {
  return {
    body,
    params: { id: row.id },
    scope: {
      resolve: () => ({
        listJovyEvents: async () => [row],
        listHeroItems: async () => [row],
        listMarketingBanners: async () => [row],
      }),
    },
  } as unknown as MedusaRequest
}

type WorkflowMock = jest.Mock<Promise<{ result: Record<string, unknown> }>, [{ input: Record<string, unknown> }]>

const runEvent = jest.fn() as unknown as WorkflowMock
const runHero = jest.fn() as unknown as WorkflowMock
const runBanner = jest.fn() as unknown as WorkflowMock

async function invoke(
  handler: (req: MedusaRequest, res: MedusaResponse) => Promise<unknown>,
  row: Record<string, unknown>,
  body: unknown,
  workflow: WorkflowMock,
) {
  const response = fakeResponse()
  await handler(fakeRequest(row, body), response as unknown as MedusaResponse)
  expect(response.statusCode).toBe(200)
  const calls = workflow.mock.calls
  return calls[calls.length - 1]?.[0].input
}

const startsAt = "2027-01-05T08:30:00.000Z"
const endsAt = "2027-01-05T18:00:00.000Z"

describe("PUT dates: explicit null clears, omission preserves, value updates", () => {
  beforeEach(() => {
    const workflows: Array<[jest.Mock, WorkflowMock]> = [
      [saveEventWorkflow as unknown as jest.Mock, runEvent],
      [saveHeroWorkflow as unknown as jest.Mock, runHero],
      [saveBannerWorkflow as unknown as jest.Mock, runBanner],
    ]
    for (const [factory, run] of workflows) {
      run.mockReset()
      run.mockImplementation(async ({ input }) => ({ result: input }))
      factory.mockReset()
      factory.mockReturnValue({ run })
    }
  })

  it("eventos", async () => {
    const cleared = await invoke(updateEvent, eventRow, { starts_at: null, ends_at: null }, runEvent)
    expect(cleared).toMatchObject({ starts_at: null, ends_at: null })

    const preserved = await invoke(updateEvent, eventRow, {}, runEvent)
    expect(preserved).toMatchObject({
      starts_at: eventRow.starts_at.toISOString(),
      ends_at: eventRow.ends_at.toISOString(),
    })

    const updated = await invoke(updateEvent, eventRow, { starts_at: startsAt, ends_at: endsAt }, runEvent)
    expect(updated).toMatchObject({ starts_at: startsAt, ends_at: endsAt })
  })

  it("Hero", async () => {
    const cleared = await invoke(updateHero, heroRow, { starts_at: null, ends_at: null }, runHero)
    expect(cleared).toMatchObject({ starts_at: null, ends_at: null })

    const preserved = await invoke(updateHero, heroRow, {}, runHero)
    expect(preserved).toMatchObject({
      starts_at: heroRow.starts_at.toISOString(),
      ends_at: heroRow.ends_at.toISOString(),
    })

    const updated = await invoke(updateHero, heroRow, { starts_at: startsAt, ends_at: endsAt }, runHero)
    expect(updated).toMatchObject({ starts_at: startsAt, ends_at: endsAt })
  })

  it("Banners", async () => {
    const cleared = await invoke(updateBanner, bannerRow, { starts_at: null, ends_at: null }, runBanner)
    expect(cleared).toMatchObject({ starts_at: null, ends_at: null })

    const preserved = await invoke(updateBanner, bannerRow, {}, runBanner)
    expect(preserved).toMatchObject({
      starts_at: bannerRow.starts_at.toISOString(),
      ends_at: bannerRow.ends_at.toISOString(),
    })

    const updated = await invoke(updateBanner, bannerRow, { starts_at: startsAt, ends_at: endsAt }, runBanner)
    expect(updated).toMatchObject({ starts_at: startsAt, ends_at: endsAt })
  })
})
