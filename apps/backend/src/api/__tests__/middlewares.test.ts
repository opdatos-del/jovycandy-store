import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import middlewares from "../middlewares"

type FakeResponse = {
  statusCode: number
  body: unknown
  status: (code: number) => FakeResponse
  json: (body: unknown) => FakeResponse
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
  }
  return response
}

function fakeRequest(session: Record<string, unknown> = {}) {
  return {
    headers: {},
    session,
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
