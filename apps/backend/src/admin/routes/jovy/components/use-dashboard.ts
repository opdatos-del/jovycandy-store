import { useCallback, useEffect, useRef, useState } from "react"
import { adminRequest, errorMessage } from "./admin-api"
import { AUTO_REFRESH_SECONDS, type JovyDashboard } from "./dashboard-model"

type LoadMode = "initial" | "refresh"

const FALLBACK_ERROR = "No se pudo cargar el tablero."

/**
 * Estado del tablero con refresco manual y automático.
 *
 * El endpoint solo agrega lecturas (`GET /admin/jovy/dashboard`), por lo que un
 * refresco periódico es seguro. El intervalo se cancela al ocultar la pestaña y
 * se reanuda con una lectura fresca al volver a ella.
 */
export function useDashboard() {
  const [dashboard, setDashboard] = useState<JovyDashboard | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const latestRequest = useRef(0)

  const load = useCallback(async (mode: LoadMode) => {
    const requestId = latestRequest.current + 1
    latestRequest.current = requestId

    if (mode === "initial") setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const result = await adminRequest<JovyDashboard>("/admin/jovy/dashboard")
      if (latestRequest.current !== requestId) return
      setDashboard(result)
      setError(null)
    } catch (reason) {
      if (latestRequest.current !== requestId) return
      setError(errorMessage(reason, FALLBACK_ERROR))
    } finally {
      if (latestRequest.current === requestId) {
        setIsLoading(false)
        setIsRefreshing(false)
      }
    }
  }, [])

  useEffect(() => {
    void load("initial")
  }, [load])

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null

    const stop = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }

    const start = () => {
      stop()
      if (document.visibilityState !== "visible") return
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void load("refresh")
      }, AUTO_REFRESH_SECONDS * 1000)
    }

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop()
        return
      }
      void load("refresh")
      start()
    }

    start()
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      stop()
      document.removeEventListener("visibilitychange", handleVisibility)
    }
  }, [load])

  const refresh = useCallback(() => load("refresh"), [load])
  const retry = useCallback(() => load(dashboard ? "refresh" : "initial"), [dashboard, load])

  return { dashboard, isLoading, isRefreshing, error, refresh, retry }
}
