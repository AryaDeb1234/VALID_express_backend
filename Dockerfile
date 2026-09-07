# Stage 1: Build
FROM node:18-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Stage 2: Production
FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist

RUN npm ci --omit=dev && npm cache clean --force

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