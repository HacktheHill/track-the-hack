# syntax=docker/dockerfile:1.7
FROM node:24-bookworm-slim AS studio
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --system --gid 1001 app \
	&& useradd --system --uid 1001 --gid app --create-home app
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma
RUN npm ci --include=dev && npm cache clean --force
USER app
EXPOSE 5555
STOPSIGNAL SIGTERM
CMD ["npx", "prisma", "studio", "--browser", "none", "--hostname", "0.0.0.0", "--port", "5555"]

FROM node:24-bookworm-slim AS migration
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --system --gid 1001 app \
	&& useradd --system --uid 1001 --gid app app
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma
RUN npm ci --include=dev && npm cache clean --force
USER app
STOPSIGNAL SIGTERM
CMD ["npx", "prisma", "migrate", "deploy"]

FROM node:24-bookworm-slim AS build
WORKDIR /app
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY .npmrc ./
COPY prisma ./prisma
RUN npm ci
COPY . .
ENV NODE_ENV=production
ENV SKIP_ENV_VALIDATION=1
RUN --mount=type=secret,id=env \
	set -a && . /run/secrets/env && set +a && npm run build
RUN npm prune --omit=dev && npm cache clean --force

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
RUN apt-get update \
	&& apt-get install -y --no-install-recommends ca-certificates openssl \
	&& rm -rf /var/lib/apt/lists/* \
	&& groupadd --system --gid 1001 app \
	&& useradd --system --uid 1001 --gid app app
COPY --from=build --chown=app:app /app/package*.json ./
COPY --from=build --chown=app:app /app/node_modules ./node_modules
COPY --from=build --chown=app:app /app/.next ./.next
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/next.config.js ./
COPY --from=build --chown=app:app /app/next-i18next.config.js ./
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/src/env ./src/env
USER app
EXPOSE 3000
STOPSIGNAL SIGTERM
CMD ["npm", "run", "start"]
