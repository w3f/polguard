FROM node:18-alpine AS builder

WORKDIR /app

RUN apk add --no-cache yarn

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache yarn

COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create a directory for the app config
RUN mkdir config

CMD ["node", "dist/service/main"]
