FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json index.html ./
COPY src ./src
COPY public ./public
COPY server ./server
COPY data ./data
COPY scripts ./scripts
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
RUN groupadd --gid 10001 basira && useradd --uid 10001 --gid 10001 --create-home basira
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/data ./data
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/package.json ./package.json
COPY docker ./docker
RUN mkdir -p /app/.local && chown 10001:10001 /app/.local && ln -s /app/.local/docker.env /app/.env
# Launcher reads the host-owned secret, then drops to UID/GID 10001.
USER 0:0
EXPOSE 3000
CMD ["node", "/app/docker/app_entry.mjs"]
