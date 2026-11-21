# syntax=docker/dockerfile:1
# VetNexa AI service (wound assessment + pet-care assistant), CPU-only PyTorch.
#   docker build -t vetnexa-ai services/ai
#
# The trained model is NOT baked into the image: mount it at /app/models (see Compose).
# Without a model the service still starts; wound assessment answers 503 and the assistant works.

FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    VETNEXA_AI_HOST=0.0.0.0 \
    VETNEXA_AI_PORT=8000

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY vetnexa_ai vetnexa_ai
COPY knowledge knowledge
RUN useradd --create-home --uid 10001 vetnexa && mkdir -p models && chown vetnexa models

USER vetnexa
EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4).status == 200 else 1)"
CMD ["python", "-m", "vetnexa_ai.service"]
