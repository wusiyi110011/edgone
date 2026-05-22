FROM node:22-alpine AS builder

WORKDIR /app

COPY apps/h5/package.json apps/h5/package-lock.json ./apps/h5/
COPY apps/server/package.json apps/server/package-lock.json ./apps/server/

RUN npm ci --prefix apps/h5
RUN npm ci --prefix apps/server

COPY apps ./apps

RUN npm --prefix apps/h5 run build
RUN npm --prefix apps/server run build

FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=80

COPY apps/server/package.json apps/server/package-lock.json ./apps/server/
RUN npm ci --omit=dev --prefix apps/server

COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/h5/dist ./apps/h5/dist

EXPOSE 80

CMD ["node", "apps/server/dist/index.js"]
