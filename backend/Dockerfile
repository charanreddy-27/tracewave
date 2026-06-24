# Tracewave backend image — one image, three roles (ingestor / processor / api),
# selected by the compose `command`.
FROM python:3.11-slim AS base

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install deps first for layer caching.
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install .

# App source
COPY tracewave ./tracewave

# Non-root
RUN useradd -m -u 10001 tracewave && chown -R tracewave /app
USER tracewave

EXPOSE 8000 9100
# Default role is the API; compose overrides for ingestor/processor.
CMD ["uvicorn", "tracewave.api.main:get_app", "--factory", "--host", "0.0.0.0", "--port", "8000"]
