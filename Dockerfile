# syntax=docker/dockerfile:1.7

# --- deps stage: install full dependency tree ---
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --include=dev

# --- dev stage: Next.js dev server with HMR (used by docker-compose) ---
FROM node:22-alpine AS dev
RUN apk add --no-cache libc6-compat openssl tini
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=development \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
EXPOSE 3000
COPY docker/entrypoint.dev.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "dev"]

# --- build stage: next build with full deps ---
FROM node:22-alpine AS build
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
# AUTH_SECRET is required by Auth.js at build time as a placeholder; runtime value comes from env.
ENV AUTH_SECRET=build-only-placeholder-aaaaaaaaaaaaaaaa
RUN npm run build

# --- runner stage: production image ---
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl tini wget
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -g 1001 -S nodejs && \
    adduser -u 1001 -S nextjs -G nodejs && \
    mkdir -p /data/db /data/uploads && \
    chown -R nextjs:nodejs /data
# Full deps + .next + prisma artifacts. Larger image but Prisma CLI's transitive
# tree (effect, @prisma/engines, ...) is needed at runtime for `migrate deploy`.
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --chown=nextjs:nodejs docker/entrypoint.prod.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["npm", "run", "start"]
