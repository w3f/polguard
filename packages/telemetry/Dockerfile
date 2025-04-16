FROM node:20-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/telemetry/package.json packages/telemetry/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files
COPY packages/types packages/types
COPY packages/telemetry packages/telemetry

# Build packages in order
RUN yarn build:types && \
    yarn build:telemetry

FROM node:20-alpine AS production

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/telemetry/package.json packages/telemetry/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install production dependencies
RUN yarn workspaces focus @w3f/monitoring-telemetry --production

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/telemetry/dist packages/telemetry/dist

# Create config directory
RUN mkdir -p packages/telemetry/config

WORKDIR /app/packages/telemetry

CMD ["node", "dist/telemetry/src/service/main"]
