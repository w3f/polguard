FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache yarn

# Copy only necessary files for installation
COPY package.json yarn.lock ./
COPY packages/types/package.json packages/types/
COPY packages/matrix/package.json packages/matrix/

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source files
COPY packages/types packages/types
COPY packages/matrix packages/matrix

# Build packages in order
RUN yarn workspace @w3f/monitoring-types build && \
    yarn workspace @w3f/monitoring-matrix build

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache yarn

# Copy only necessary files for production
COPY package.json yarn.lock ./
COPY packages/types/package.json packages/types/
COPY packages/matrix/package.json packages/matrix/

# Install production dependencies
RUN yarn install --production --frozen-lockfile

# Copy built files
COPY --from=builder /app/packages/types/dist packages/types/dist
COPY --from=builder /app/packages/matrix/dist packages/matrix/dist

# Create config directory
RUN mkdir -p packages/matrix/config

WORKDIR /app/packages/matrix

CMD ["node", "dist/service/main"]