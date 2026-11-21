"""HTTP inference service used by the VetNexa API.

It is an internal service: only the Node API calls it, never the browser. The API checks who
the user is and stores the result; this service only turns a photo into a cautious assessment.

    GET  /health   whether a model is loaded, its version and whether it is a demo model
    POST /assess   body = the image bytes (JPEG, PNG or WebP), returns the assessment JSON

Run it with:

    python -m vetnexa_ai.service            # http://127.0.0.1:8000

Settings (environment variables):

    VETNEXA_AI_MODEL   checkpoint path (default models/wound-classifier.pt)
    VETNEXA_AI_TOKEN   shared secret; when set, requests must send it in X-Service-Token
    VETNEXA_AI_HOST    default 127.0.0.1
    VETNEXA_AI_PORT    default 8000

If no checkpoint exists the service still starts, reports `modelLoaded: false` and answers
/assess with 503, so the rest of the platform keeps working.
"""

from __future__ import annotations

import hmac
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from .assessment import Assessor
from .quality import InvalidImageError

logger = logging.getLogger("vetnexa_ai.service")

#: Larger uploads are refused before decoding (the API already limits photos to 5 MB).
MAX_IMAGE_BYTES = 10 * 1024 * 1024
DEFAULT_MODEL = Path(__file__).resolve().parent.parent / "models" / "wound-classifier.pt"


def error(status: int, code: str, message: str) -> JSONResponse:
    """Same error shape as the Node API: { "error": { "code", "message" } }."""
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


def load_assessor(path: Path) -> Assessor | None:
    if not path.is_file():
        logger.warning("No model at %s; /assess will answer 503 until one is trained.", path)
        return None
    assessor = Assessor.from_checkpoint(path)
    logger.info("Loaded %s%s", assessor.version, " (DEMO model)" if assessor.demo else "")
    return assessor


def create_app(assessor: Assessor | None, token: str | None = None) -> FastAPI:
    """Builds the app. The assessor is passed in so tests can use a small model."""
    app = FastAPI(title="VetNexa AI service", docs_url=None, redoc_url=None, openapi_url=None)

    @app.middleware("http")
    async def require_token(request: Request, call_next):
        if token and request.url.path != "/health":
            sent = request.headers.get("x-service-token", "")
            if not hmac.compare_digest(sent.encode(), token.encode()):
                return error(401, "UNAUTHORIZED", "Missing or wrong service token")
        return await call_next(request)

    @app.get("/health")
    async def health():
        return {
            "status": "ok",
            "modelLoaded": assessor is not None,
            "modelVersion": assessor.version if assessor else None,
            "demoModel": assessor.demo if assessor else None,
        }

    @app.post("/assess")
    async def assess(request: Request):
        if assessor is None:
            return error(
                503, "MODEL_UNAVAILABLE", "The wound assessment model is not available yet."
            )
        length = request.headers.get("content-length")
        if length and length.isdigit() and int(length) > MAX_IMAGE_BYTES:
            return error(413, "TOO_LARGE", "The image is too large.")
        data = await request.body()
        if not data:
            return error(422, "INVALID_IMAGE", "No image was sent.")
        if len(data) > MAX_IMAGE_BYTES:
            return error(413, "TOO_LARGE", "The image is too large.")
        try:
            # Inference is CPU-bound, so it runs in a worker thread and does not block others.
            return await run_in_threadpool(assessor.assess, data)
        except InvalidImageError:
            return error(422, "INVALID_IMAGE", "The file is not a valid image.")

    return app


def main() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
    model_path = Path(os.environ.get("VETNEXA_AI_MODEL", DEFAULT_MODEL))
    app = create_app(load_assessor(model_path), os.environ.get("VETNEXA_AI_TOKEN") or None)
    uvicorn.run(
        app,
        host=os.environ.get("VETNEXA_AI_HOST", "127.0.0.1"),
        port=int(os.environ.get("VETNEXA_AI_PORT", "8000")),
    )


if __name__ == "__main__":
    main()
