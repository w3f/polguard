FROM node:18-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/watcher/package.json packages/watcher/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files
COPY packages/types packages/types
COPY packages/config packages/config
COPY packages/watcher packages/watcher

# Build packages in order
RUN yarn build:types && \
    yarn build:config && \
    yarn build:watcher

FROM node:18-alpine

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/watcher/package.json packages/watcher/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install production dependencies
RUN yarn workspaces focus @w3f/monitoring-watcher --production

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/config/dist packages/config/dist
COPY --from=builder /app/packages/watcher/dist packages/watcher/dist

# Create config directory
RUN mkdir -p packages/watcher/config

WORKDIR /app/packages/watcher

CMD ["node", "dist/watcher/src/service/main"]