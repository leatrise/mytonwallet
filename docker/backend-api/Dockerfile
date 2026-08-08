FROM node:22.19.0-alpine3.22 AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci
COPY src ./src
COPY data ./data
RUN npm run build && npm prune --omit=dev

FROM node:22.19.0-alpine3.22
ENV NODE_ENV=production
USER node
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/data ./data
EXPOSE 3000
CMD ["node", "dist/index.js"]
