import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { consumeEventVideoUpload } from "@jovy/lib/jovy/events-media"
import middlewares from "../middlewares"

jest.mock("@jovy/lib/jovy/event-video-upload", () => ({
  // El carril real de `multer` se prueba en `event-video-upload.test.ts`; aquí
  // sólo interesa qué clave de rate limit recibe cada solicitud.
  createEventVideoUpload: () => ({
    array: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  }),
}))

jest.mock("@jovy/lib/jovy/events-media", () => ({
  ...jest.requireActual("@jovy/lib/jovy/events-media"),
  consumeEventVideoUpload: jest.fn(() => ({ allowed: true })),
  acquireEventVideoUploadLock: jest.fn(() => "test-lock"),
  releaseEventVideoUploadLock: jest.fn(),
  removeEventVideoTempFile: jest.fn(async () => {}),
}))

type FakeResponse = {
  statusCode: number
  body: unknown
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
  setHeader: (name: string, value: string) => FakeResponse
  once: (event: string, listener: () => void) => FakeResponse
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
    setHeader() {
      return response
    },
    once() {
      return response
    },
  }
  return response
}

function fakeRequest(session: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) {
  return {
    headers: {},
    session,
    ...extra,
    scope: {
      resolve: (key: string) =>
        key === ContainerRegistrationKeys.LOGGER ? { debug: jest.fn() } : { projectConfig: { http: {} } },
    },
  }
}

const adminRoute = middlewares.routes?.find((route) => route.matcher === "/admin/jovy/*")
const guard = adminRoute?.middlewares?.[0]

describe("autenticación de las rutas administrativas de Jovy", () => {
  it("aplica el guardia a todos los métodos de /admin/jovy/*", () => {
    expect(adminRoute).toBeDefined()
    // `methods` ausente significa que el matcher cubre GET, POST, PUT y DELETE.
    expect(adminRoute!.methods).toBeUndefined()
    expect(guard).toBeDefined()
    expect(adminRoute!.middlewares).toHaveLength(1)
  })

  it("responde 401 sin sesión ni token", async () => {
    const next = jest.fn()
    for (const _method of ["GET", "POST", "PUT", "DELETE"]) {
      const response = fakeResponse()
      await guard!(fakeRequest() as never, response as never, next)
      expect(response.statusCode).toBe(401)
      expect(response.body).toEqual({ message: "Unauthorized" })
    }
    expect(next).not.toHaveBeenCalled()
  })

  it("sólo acepta actores de tipo user", async () => {
    const next = jest.fn()

    const customer = fakeResponse()
    await guard!(
      fakeRequest({ auth_context: { actor_id: "cus_01", actor_type: "customer" } }) as never,
      customer as never,
      next,
    )
    expect(customer.statusCode).toBe(401)
    expect(next).not.toHaveBeenCalled()

    const user = fakeResponse()
    await guard!(
      fakeRequest({ auth_context: { actor_id: "usr_01", actor_type: "user" } }) as never,
      user as never,
      next,
    )
    expect(next).toHaveBeenCalledTimes(1)
  })
})

const videoRoute = middlewares.routes?.find((route) => route.matcher === "/admin/jovy/events/media/video")
const videoMiddleware = videoRoute?.middlewares?.[0] as unknown as (
  req: unknown,
  res: unknown,
  next: () => void,
) => void

describe("rate limit del carril de vídeo de eventos", () => {
  const consume = consumeEventVideoUpload as jest.Mock

  beforeEach(() => {
    consume.mockClear()
    consume.mockReturnValue({ allowed: true })
  })

  it("usa una clave por actor autenticado y conserva el fallback por IP", () => {
    expect(videoMiddleware).toBeDefined()
    const next = jest.fn()

    // Dos actores comparten IP: no deben compartir la ventana de rate limit.
    const first = fakeResponse()
    videoMiddleware(
      fakeRequest({}, { ip: "10.0.0.1", auth_context: { actor_id: "usr_a" }, auth: { actor_id: "usr_legacy" } }),
      first,
      next,
    )

    const second = fakeResponse()
    videoMiddleware(
      fakeRequest({}, { ip: "10.0.0.1", auth_context: { actor_id: "usr_b" }, auth: { actor_id: "usr_legacy" } }),
      second,
      next,
    )

    // Sin actor autenticado, la solicitud sigue limitada por IP.
    const anonymous = fakeResponse()
    videoMiddleware(fakeRequest({}, { ip: "10.0.0.2" }), anonymous, next)

    expect(consume.mock.calls.map(([key]) => key)).toEqual([
      "user:usr_a",
      "user:usr_b",
      "ip:10.0.0.2",
    ])
    expect(next).toHaveBeenCalledTimes(3)
  })

  it("mantiene el 429 cuando la ventana del actor se agota", () => {
    consume.mockReturnValue({ allowed: false, retryAfterSeconds: 42 })
    const response = fakeResponse()

    videoMiddleware(fakeRequest({}, { ip: "10.0.0.1", auth_context: { actor_id: "usr_a" } }), response, jest.fn())

    expect(response.statusCode).toBe(429)
    expect(response.body).toMatchObject({ message: expect.stringContaining("Demasiadas subidas") })
  })
})
