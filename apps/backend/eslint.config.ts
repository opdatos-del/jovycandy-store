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
)
