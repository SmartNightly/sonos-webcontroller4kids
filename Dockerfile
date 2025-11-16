# Multi-stage build für Frontend und Backend
FROM node:18-alpine AS builder

# Build Frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
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

# Copy backend dependencies and built files
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package*.json ./backend/

# Copy frontend build
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy media-data
COPY media-data ./media-data

# Expose port
EXPOSE 3344

# Start backend
CMD ["node", "backend/dist/index.js"]
