FROM node:18-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/chain-watcher/package.json packages/chain-watcher/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files
COPY packages/types packages/types
COPY packages/config packages/config
COPY packages/chain-watcher packages/chain-watcher

# Build packages in order
RUN yarn build:types && \
    yarn build:config && \
    yarn build:chain-watcher

FROM node:18-alpine

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/chain-watcher/package.json packages/chain-watcher/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install production dependencies
RUN yarn workspaces focus @w3f/monitoring-chain-watcher --production

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/config/dist packages/config/dist
COPY --from=builder /app/packages/chain-watcher/dist packages/chain-watcher/dist

# Create config directory
RUN mkdir -p packages/chain-watcher/config

WORKDIR /app/packages/chain-watcher

CMD ["node", "dist/service/main"]