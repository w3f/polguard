FROM node:20-alpine AS builder

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files for all packages
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/api/package.json packages/api/
COPY packages/chain/package.json packages/chain/
COPY packages/matrix/package.json packages/matrix/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Install dependencies
RUN yarn install

# Copy source files for all packages
COPY packages/types packages/types
COPY packages/config packages/config
COPY packages/api packages/api
COPY packages/chain packages/chain
COPY packages/matrix packages/matrix

# Build all packages in dependency order
RUN yarn build

FROM node:20-alpine AS production

WORKDIR /app

# Copy yarn configuration files
COPY .yarnrc.yml package.json yarn.lock ./
COPY .yarn ./.yarn

# Copy package.json files for all packages
COPY packages/types/package.json packages/types/
COPY packages/config/package.json packages/config/
COPY packages/api/package.json packages/api/
COPY packages/chain/package.json packages/chain/
COPY packages/matrix/package.json packages/matrix/

# Enable Yarn Berry
RUN corepack enable && corepack prepare yarn@4.6.0 --activate

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules /app/node_modules

# Copy built files from builder stage
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/config/dist packages/config/dist
COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/chain/dist packages/chain/dist
COPY --from=builder /app/packages/matrix/dist packages/matrix/dist

# Create config directories
RUN mkdir -p packages/api/config \
    packages/chain/config \
    packages/matrix/config

# Set yarn as the entrypoint
ENTRYPOINT ["yarn"]

# No default command - users must specify which service to run
# Example: docker run image_name start:api
# Example: docker run image_name start:chain
# Example: docker run image_name start:matrix
