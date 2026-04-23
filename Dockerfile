# syntax=docker/dockerfile:1

FROM node:20-slim

WORKDIR /app

COPY package.json tsconfig.json README.md ./
COPY src ./src
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN npm install \
    && npm run build \
    && npm prune --omit=dev \
    && chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "/app/dist/cli.js"]
