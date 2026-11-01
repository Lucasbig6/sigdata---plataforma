# Contexto de build = raiz do repositório (o backend importa ../shared):
#   docker build -f backend/Dockerfile -t sigdata-backend .
FROM node:24-slim AS build
WORKDIR /app
COPY shared ./shared
COPY backend/package.json backend/package-lock.json ./backend/
RUN npm --prefix backend ci
COPY backend ./backend
RUN npm --prefix backend run build && npm --prefix backend prune --omit=dev

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app/backend
COPY --from=build /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
COPY --from=build /app/backend/drizzle ./drizzle
COPY --from=build /app/backend/package.json ./
VOLUME /app/backend/storage
EXPOSE 4000
USER node
CMD ["sh", "-c", "node dist/migrate.js && node dist/server.js"]
