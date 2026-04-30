# syntax=docker/dockerfile:1

# ── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /build

# Copy workspace manifests needed to resolve the monorepo
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/api/package.json ./apps/api/

RUN npm ci --ignore-scripts

# Copy source
COPY packages/shared/ ./packages/shared/
COPY packages/api-client/ ./packages/api-client/
COPY apps/api/ ./apps/api/

# Build shared packages first, then api
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=packages/api-client
RUN npm run build --workspace=apps/api

# ── Stage 2: production image ────────────────────────────────────────────────
FROM node:22-alpine AS runner

ENV NODE_ENV=production

WORKDIR /app

# Non-root user for security
RUN addgroup --system --gid 1001 fieldops \
 && adduser  --system --uid 1001 --ingroup fieldops fieldops

# Copy only production dependencies
COPY package.json package-lock.json turbo.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/api-client/package.json ./packages/api-client/
COPY apps/api/package.json ./apps/api/

RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy compiled output from builder
COPY --from=builder /build/packages/shared/dist ./packages/shared/dist
COPY --from=builder /build/packages/api-client/dist ./packages/api-client/dist
COPY --from=builder /build/apps/api/dist ./apps/api/dist

USER fieldops

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
