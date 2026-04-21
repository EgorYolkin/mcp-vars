# syntax=docker/dockerfile:1

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app --home /app app

COPY pyproject.toml README.md requirements.txt ./
COPY mcp_vars ./mcp_vars
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir --no-build-isolation --no-deps .
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER app

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["mcp-vars"]
