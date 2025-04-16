FROM node:20-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/api/package.json packages/api/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files
COPY packages/types packages/types
COPY packages/config packages/config
COPY packages/api packages/api

# Build packages in order
RUN yarn build:types && \
    yarn build:config && \
    yarn build:api

FROM node:20-alpine AS production

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/api/package.json packages/api/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install production dependencies
RUN yarn workspaces focus @w3f/monitoring-api --production

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/config/dist packages/config/dist
COPY --from=builder /app/packages/api/dist packages/api/dist

# Create config directory
RUN mkdir -p packages/api/config

WORKDIR /app/packages/api

CMD ["node", "dist/api/src/main"]
