# syntax=docker/dockerfile:1.7

FROM node:23-bookworm-slim AS build

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json tsconfig.json ./
COPY src ./src

# Install dependencies without running lifecycle scripts so the build stays explicit.
RUN npm ci --ignore-scripts

# Compile the application once the source tree is in place.
RUN npm run build

# Trim the image payload down to runtime dependencies after the build succeeds.
RUN npm prune --omit=dev && npm cache clean --force


FROM node:23-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV SERVER_HOST=0.0.0.0
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN groupadd --system nodejs \
    && useradd --system --gid nodejs --create-home --home-dir /home/nodeapp nodeapp \
    && chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chown -R nodeapp:nodejs /app

USER nodeapp

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/ping').then((res) => process.exit(res.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
