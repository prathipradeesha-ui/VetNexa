# syntax=docker/dockerfile:1
# MinIO object storage, built from MinIO's official open-source code (GNU AGPL v3).
#
# MinIO stopped publishing community container images, so VetNexa builds a pinned release itself.
# The code is used unmodified and runs as a separate service; see docs/architecture.md.
#   docker build -t vetnexa-minio infra/minio

ARG MINIO_RELEASE=RELEASE.2025-10-15T17-29-55Z

# ── build ──
FROM golang:1.24-bookworm AS build
ARG MINIO_RELEASE
# GOTOOLCHAIN=auto lets Go fetch the exact compiler version the release asks for.
ENV CGO_ENABLED=0 \
    GOTOOLCHAIN=auto
WORKDIR /src
RUN git clone --depth 1 --branch "${MINIO_RELEASE}" https://github.com/minio/minio.git .
RUN go build -trimpath \
      -ldflags "-s -w -X github.com/minio/minio/cmd.ReleaseTag=${MINIO_RELEASE}" \
      -o /out/minio .

# ── runtime ──
FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 10002 --create-home minio \
    && mkdir -p /data \
    && chown minio:minio /data
COPY --from=build /out/minio /usr/local/bin/minio

USER minio
EXPOSE 9000 9001
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -fsS http://127.0.0.1:9000/minio/health/live || exit 1
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--console-address", ":9001"]
