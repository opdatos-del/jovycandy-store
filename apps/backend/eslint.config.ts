import { defineConfig } from "eslint/config"
import medusa from "@medusajs/eslint-plugin"

export default defineConfig(
  ...medusa.configs.recommended,
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.\\./){2,}",
              message: "Usa el alias @jovy/* para imports internos que suban dos o más niveles.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/admin/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Usa adminRequest de @admin/shared/lib/admin-api en el bundle del Admin.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.\\./){2,}",
              message: "Usa el alias @admin/* para imports internos del Admin.",
            },
            {
              group: ["@jovy/modules/*", "@jovy/workflows/*", "@jovy/api/*"],
              message: "El Admin no puede importar código de Node del backend.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/admin/shared/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(\\.\\./){2,}",
              message: "Usa el alias @admin/* para imports internos del Admin.",
            },
            {
              group: ["@admin/features/*", "@admin/routes/*"],
              message: "shared no puede depender de features ni de rutas.",
            },
            {
              group: ["@jovy/modules/*", "@jovy/workflows/*", "@jovy/api/*"],
              message: "El Admin no puede importar código de Node del backend.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/admin/shared/lib/admin-api.ts"],
    rules: {
      "no-restricted-globals": "off",
    },
  },
)
