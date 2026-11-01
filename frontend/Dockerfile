# Contexto de build = raiz do repositório (o frontend importa ../shared):
#   docker build -f frontend/Dockerfile -t sigdata-frontend .
FROM node:24-slim AS build
WORKDIR /app
COPY shared ./shared
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN npm --prefix frontend ci
COPY frontend ./frontend
ARG BACKEND_URL=http://backend:4000
ENV BACKEND_URL=$BACKEND_URL
RUN npm --prefix frontend run build

FROM node:24-slim
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/frontend/.next/standalone ./
COPY --from=build /app/frontend/.next/static ./frontend/.next/static
EXPOSE 3000
USER node
CMD ["node", "frontend/server.js"]
