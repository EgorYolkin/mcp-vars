ARG OPENCLAW_BASE_IMAGE=openclaw:latest
FROM ${OPENCLAW_BASE_IMAGE}

USER root

# Example for Debian/Ubuntu-based OpenClaw images.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip python3-venv ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/mcp-vars

COPY pyproject.toml README.md requirements.txt ./
COPY mcp_vars ./mcp_vars
COPY deploy/openclaw/openclaw-mcp-vars.sh /usr/local/bin/openclaw-mcp-vars

RUN chmod +x /usr/local/bin/openclaw-mcp-vars \
    && python3 -m pip install --no-cache-dir -r requirements.txt \
    && python3 -m pip install --no-cache-dir --no-build-isolation --no-deps .

ENTRYPOINT ["/bin/sh"]
