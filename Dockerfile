# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy backend package files
COPY agentbank-clean/backend/package*.json ./

# Install dependencies
RUN npm ci

# Copy backend source
COPY agentbank-clean/backend/src ./src
COPY agentbank-clean/backend/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy package files from builder
COPY agentbank-clean/backend/package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy .env file (needed since Railway Variables aren't being injected properly)
COPY agentbank-clean/backend/.env ./

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 3001

# Start application
CMD ["npm", "start"]
