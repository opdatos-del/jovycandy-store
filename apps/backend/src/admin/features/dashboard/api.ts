import { adminRequest } from "@admin/shared/lib/admin-api"
import type { JovyDashboard } from "./lib/dashboard-model"

/** Lectura agregada del CMS; el endpoint es de solo lectura. */
export const dashboardApi = {
  get: () => adminRequest<JovyDashboard>("/admin/jovy/dashboard"),
}
