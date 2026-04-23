ARG OPENCLAW_BASE_IMAGE=openclaw:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

RUN apt-get update \
    && apt-get install -y --no-install-recommends nodejs npm ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/mcp-vars

COPY package.json tsconfig.json README.md ./
COPY src ./src
COPY deploy/openclaw/openclaw-mcp-vars.sh /usr/local/bin/openclaw-mcp-vars

RUN chmod +x /usr/local/bin/openclaw-mcp-vars \
    && npm install \
    && npm run build \
    && npm prune --omit=dev

ENTRYPOINT ["/bin/sh"]
