FROM node:22-bookworm-slim AS build
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --include=dev
COPY backend/tsconfig.json ./
COPY backend/src ./src
COPY backend/tests ./tests
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/backend/dist ./dist
COPY database/queries /app/database/queries
USER node
CMD ["npm", "start"]
