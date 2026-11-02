FROM node:24-alpine AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS development
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM deps AS builder
COPY . .
ENV NODE_ENV=production
RUN npm run build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
ARG APP_UID=1000
ARG APP_GID=1000
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/public ./public
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/.next/standalone ./
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/.next/static ./.next/static
COPY --from=builder --chown=${APP_UID}:${APP_GID} /app/ops/queue-services.mjs ./ops/queue-services.mjs
RUN mkdir -p /app/uploads /app/.next/cache \
    && chown -R ${APP_UID}:${APP_GID} /app/uploads /app/.next/cache
USER ${APP_UID}:${APP_GID}
EXPOSE 3000
CMD ["node", "server.js"]
