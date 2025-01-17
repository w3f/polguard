FROM node:18-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/matrix/package.json packages/matrix/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files
COPY packages/types packages/types
COPY packages/matrix packages/matrix

# Build packages in order
RUN yarn build:types && \
    yarn build:matrix

FROM node:18-alpine

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/matrix/package.json packages/matrix/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install production dependencies
RUN yarn workspaces focus @w3f/monitoring-matrix --production

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/matrix/dist packages/matrix/dist

# Create config directory
RUN mkdir -p packages/matrix/config

WORKDIR /app/packages/matrix

CMD ["node", "dist/matrix/src/service/main"]