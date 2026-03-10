# Multi-stage build für Frontend und Backend
FROM node:18-alpine AS builder

# Build args for version metadata (passed at build time)
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown

# Build Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
# Copy root package.json for version injection in vite.config.ts
COPY package.json /app/package.json
# Ensure all config files are present
RUN ls -la
RUN npm run build

# Build Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

# Production image
FROM node:18-alpine

WORKDIR /app

# Embed build metadata as environment variables
ARG GIT_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV GIT_COMMIT=$GIT_COMMIT
ENV BUILD_DATE=$BUILD_DATE

# Copy backend dependencies and built files
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy media-data
COPY media-data ./media-data

# Set default port
ENV PORT=3344

# Expose port
EXPOSE 3344

# Start backend
CMD ["node", "backend/dist/index.js"]
