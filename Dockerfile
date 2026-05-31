# syntax=docker/dockerfile:1
FROM node:22-alpine

# Build deps for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

# Remove dev dependencies to slim the image
RUN npm prune --omit=dev

# Expose web port
EXPOSE 3000

# Create the `task` CLI wrapper so `docker compose run --rm app task <cmd>` works
RUN printf '#!/bin/sh\nexec node /app/dist/cli/index.js "$@"\n' \
    > /usr/local/bin/task && chmod +x /usr/local/bin/task

ENV NODE_ENV=production

CMD ["node", "dist/api/server.js"]
