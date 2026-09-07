# Stage 1: Build
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy built app and production dependencies directly from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

# Install production dependencies only and clear cache
RUN npm ci --omit=dev && npm cache clean --force

# Use non-root node user for security
USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]










# # Simple single-stage Dockerfile (not optimized for production)

# FROM node:18-alpine

# WORKDIR /app

# # install deps
# COPY package*.json ./
# RUN npm install

# # copy source
# COPY . .

# # build typescript
# RUN npm run build

# EXPOSE 3000

# CMD ["npm", "start"]
# # CMD ["npm", "run", "dev"]