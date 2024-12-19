FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache yarn

# Copy only necessary files for installation
COPY package.json yarn.lock ./
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/chain-watcher/package.json packages/chain-watcher/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source files
COPY packages/types packages/types
COPY packages/config packages/config
COPY packages/chain-watcher packages/chain-watcher

# Build packages in order
RUN yarn workspace @w3f/monitoring-types build && \
    yarn workspace @w3f/monitoring-config build && \
    yarn workspace @w3f/monitoring-chain-watcher build

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache yarn

# Copy only necessary files for production
COPY package.json yarn.lock ./
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/chain-watcher/package.json packages/chain-watcher/

# Install production dependencies
RUN yarn install --production --frozen-lockfile

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/config/dist packages/config/dist
COPY --from=builder /app/packages/chain-watcher/dist packages/chain-watcher/dist

# Create config directory
RUN mkdir -p packages/chain-watcher/config

WORKDIR /app/packages/chain-watcher

CMD ["node", "dist/service/main"]