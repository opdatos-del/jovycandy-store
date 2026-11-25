FROM node:22.23.4-bookworm-slim AS deps

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

ARG SITE_URL=http://localhost:3000
COPY apps/storefront apps/storefront
WORKDIR /app/apps/storefront

RUN export SITE_URL \
    && NEXT_PUBLIC_SITE_URL="$SITE_URL" \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000 \
    NEXT_PUBLIC_MEDUSA_PUBLISHABLE_API_KEY=pk_build_placeholder \
    pnpm build

FROM node:22.23.4-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /app/apps/storefront/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/storefront/public ./apps/storefront/public
RUN mkdir -p ./apps/storefront/.next && chown -R 1000:1000 ./apps/storefront/.next
COPY --from=builder --chown=node:node /app/apps/storefront/.next/static ./apps/storefront/.next/static

WORKDIR /app/apps/storefront
USER 1000:1000
EXPOSE 3000

CMD ["node", "server.js"]
