FROM node:22.23.4-bookworm-slim AS deps

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/storefront/package.json apps/storefront/package.json

RUN pnpm install --frozen-lockfile

FROM deps AS builder

COPY apps/backend apps/backend
WORKDIR /app/apps/backend

# Valores exclusivos de compilación. DEPLOYMENT_ENV no se define para no exigir
# infraestructura desplegada durante `medusa build`.
RUN NODE_ENV=production \
    DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/medusa_build \
    JWT_SECRET=ci-build-only-jwt-secret \
    COOKIE_SECRET=ci-build-only-cookie-secret \
    STORE_CORS=http://localhost:3000 \
    ADMIN_CORS=http://localhost:9000 \
    AUTH_CORS=http://localhost:3000,http://localhost:9000 \
    pnpm build

WORKDIR /app
RUN pnpm --filter @dtc/backend deploy --prod --legacy /deploy
RUN cp -a apps/backend/.medusa/server/. /deploy/ \
    && find /deploy -path /deploy/node_modules -prune -o -type f \( -name '*.ts' -o -name '*.tsx' \) -delete \
    && rm -rf /deploy/node_modules/@jovy \
    && ln -s ../src /deploy/node_modules/@jovy \
    && mkdir -p /deploy/static /deploy/data \
    && chown -R node:node /deploy

FROM node:22.23.4-bookworm-slim AS runner

RUN corepack enable && corepack prepare pnpm@11.17.0 --activate
WORKDIR /app

ENV NODE_ENV=production \
    PORT=9000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=builder --chown=node:node /deploy ./

USER 1000:1000
EXPOSE 9000

CMD ["pnpm", "exec", "medusa", "start"]
