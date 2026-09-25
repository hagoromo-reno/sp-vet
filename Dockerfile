# =========================================================================
# Multi-stage Dockerfile for SP-VET (Vite Frontend + Production Express Server)
# =========================================================================

FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json ./
RUN npm ci

# Copy application source
COPY . .

# Build production bundle (HTML, CSS, JS)
RUN npm run build

# =========================================================================
# Production Runner Stage
# =========================================================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm install -g tsx

# Copy built frontend assets and server codebase
COPY --from=builder /app/dist ./dist
COPY server ./server
COPY src ./src
COPY tsconfig.json ./

EXPOSE 3000

CMD ["tsx", "server/server.ts"]
