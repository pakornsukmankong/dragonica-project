# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# Runtime reference data read by ensureGameItem (resolved as dist/../../game-data).
COPY --from=build /app/game-data ./game-data
EXPOSE 3001
CMD ["node", "dist/main"]
