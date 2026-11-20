import type { ReactNode } from "react"
import { useJovyPermissions } from "../hooks/use-jovy-permissions"

type Props = {
  resource: string
  operation: string
  children: ReactNode
  fallback?: ReactNode
}

/** Oculta una acción sin permiso. No sustituye la validación del backend. */
export function PermissionGate({ resource, operation, children, fallback = null }: Props) {
  const { can, loading } = useJovyPermissions()
  if (loading) return null
  return <>{can(resource, operation) ? children : fallback}</>
}
