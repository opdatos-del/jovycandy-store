import type { NextConfig } from "next";

const distDir = process.env.JOVY_NEXT_DIST_DIR?.trim()

const nextConfig: NextConfig = {
  output: "standalone",
  ...(distDir ? { distDir } : {}),
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  logging: {
    // Stripe puede agregar un client secret a la URL antes de la redirección limpia.
    incomingRequests: { ignore: [/\/checkout\/retorno(?:[/?]|$)/] },
  },
  headers() {
    return [{
      source: "/:locale/checkout/retorno",
      headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
    }]
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
