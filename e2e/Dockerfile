FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy e2e source code and config
COPY e2e/src ./e2e/src
COPY e2e/package.json ./e2e/
COPY e2e/tsconfig.json ./e2e/

# Install dependencies (only for e2e workspace)
RUN corepack enable && \
    yarn workspaces focus @w3f/monitoring-e2e --production

# Build e2e tests
WORKDIR /app/e2e
RUN yarn build

# Set the working directory back to /app for running tests
WORKDIR /app

# Create config directory
RUN mkdir -p config

# Set the entrypoint to run Jest tests
ENTRYPOINT ["yarn", "workspace", "@w3f/monitoring-e2e", "test:e2e"]
