FROM node:18-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/incident-management/package.json packages/incident-management/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files
COPY packages/types packages/types
COPY packages/incident-management packages/incident-management

# Build packages in order
RUN yarn build:types && \
    yarn build:incident-management

FROM node:18-alpine

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files
COPY packages/types/package.json packages/types/
COPY packages/incident-management/package.json packages/incident-management/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install production dependencies
RUN yarn workspaces focus @w3f/monitoring-incident-management --production

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/incident-management/dist packages/incident-management/dist

# Create config directory
RUN mkdir -p packages/incident-management/config

WORKDIR /app/packages/incident-management

CMD ["node", "dist/incident-management/src/main"]
