"""Cethos OCR service.

Reads text out of images and scanned PDFs on infrastructure Cethos controls.
Nothing is sent to an outside provider, nothing is written to disk, and
request content is never logged (only sizes and timings are).

    POST /ocr      body = the raw file bytes (PDF, JPEG or PNG)
                   Authorization: Bearer <OCR_API_KEY>
                   ?include_images=true   also return each page as a JPEG
                   ?max_pages=10          refuse longer documents
    GET  /healthz  liveness check, no auth

Response: one entry per page with its pixel size and the text regions found.
Region coordinates are pixels in that page's rendered image, origin top-left.
"""

import base64
import hmac
import io
import logging
import os
import threading
import time

import numpy as np
import pypdfium2 as pdfium
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.concurrency import run_in_threadpool
from PIL import Image, ImageOps
from rapidocr import RapidOCR

MAX_BYTES = 25 * 1024 * 1024
MAX_PAGES_HARD = 20
RENDER_DPI = 200
MAX_SIDE = 2600  # longest side sent to the recogniser; larger pages are scaled down
ENGINE = "rapidocr"
MODEL = "PP-OCRv6 small (det + rec)"

log = logging.getLogger("cethos-ocr")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

app = FastAPI(title="Cethos OCR", docs_url=None, redoc_url=None, openapi_url=None)

_engine = None
_engine_lock = threading.Lock()  # the engine is not safe to call concurrently


def get_engine():
    global _engine
    if _engine is None:
        _engine = RapidOCR()
    return _engine


def check_auth(request: Request) -> None:
    expected = os.environ.get("OCR_API_KEY", "")
    if not expected:
        # Fail closed: an unconfigured service must not accept documents.
        raise HTTPException(status_code=503, detail="Service is not configured")
    header = request.headers.get("authorization", "")
    supplied = header[7:] if header.lower().startswith("bearer ") else ""
    if not supplied or not hmac.compare_digest(supplied.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


def sniff(data: bytes) -> str:
    if data[:5] == b"%PDF-":
        return "pdf"
    if data[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    return "unknown"


def load_pages(data: bytes, kind: str, max_pages: int) -> list[Image.Image]:
    if kind == "pdf":
        pdf = pdfium.PdfDocument(data)
        try:
            if len(pdf) > max_pages:
                raise HTTPException(status_code=413, detail=f"Document has {len(pdf)} pages; the limit is {max_pages}")
            return [pdf[i].render(scale=RENDER_DPI / 72).to_pil().convert("RGB") for i in range(len(pdf))]
        finally:
            pdf.close()
    img = Image.open(io.BytesIO(data))
    img = ImageOps.exif_transpose(img)  # phone photos carry their rotation in EXIF
    return [img.convert("RGB")]


def fit(img: Image.Image) -> Image.Image:
    scale = MAX_SIDE / max(img.size)
    if scale >= 1:
        return img
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.LANCZOS)


def recognise(img: Image.Image) -> list[dict]:
    with _engine_lock:
        res = get_engine()(np.asarray(img)[:, :, ::-1])
    boxes, txts, scores = getattr(res, "boxes", None), getattr(res, "txts", None), getattr(res, "scores", None)
    if boxes is None or txts is None:
        return []
    regions = []
    for poly, text, score in zip(boxes, txts, scores):
        pts = [[round(float(x), 1), round(float(y), 1)] for x, y in poly]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        regions.append({
            "text": text,
            "confidence": round(float(score), 4),
            "box": [min(xs), min(ys), max(xs), max(ys)],
            "polygon": pts,
        })
    return regions


def to_jpeg_b64(img: Image.Image) -> str:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def process(data: bytes, kind: str, max_pages: int, include_images: bool) -> dict:
    started = time.time()
    pages = []
    for number, raw in enumerate(load_pages(data, kind, max_pages), start=1):
        img = fit(raw)
        page = {"page": number, "width": img.width, "height": img.height, "regions": recognise(img)}
        if include_images:
            page["image_jpeg_b64"] = to_jpeg_b64(img)
        pages.append(page)
    return {
        "engine": ENGINE,
        "model": MODEL,
        "source_type": kind,
        "pages": pages,
        "seconds": round(time.time() - started, 2),
    }


@app.get("/healthz")
def healthz():
    return {"ok": True, "engine": ENGINE, "configured": bool(os.environ.get("OCR_API_KEY"))}


@app.post("/ocr")
async def ocr(
    request: Request,
    include_images: bool = Query(False),
    max_pages: int = Query(10, ge=1, le=MAX_PAGES_HARD),
):
    check_auth(request)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 25 MB")
    data = await request.body()
    if not data:
        raise HTTPException(status_code=400, detail="Empty body; send the file bytes")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File is larger than 25 MB")
    kind = sniff(data)
    if kind == "unknown":
        raise HTTPException(status_code=415, detail="Unsupported file type; send a PDF, JPEG or PNG")
    try:
        result = await run_in_threadpool(process, data, kind, max_pages, include_images)
    except HTTPException:
        raise
    except Exception as exc:  # never echo document content back in an error
        log.error("ocr failed: %s (%s, %d bytes)", type(exc).__name__, kind, len(data))
        raise HTTPException(status_code=422, detail="The file could not be read") from None
    log.info(
        "ocr ok: %s, %d bytes, %d pages, %d regions, %.2fs",
        kind, len(data), len(result["pages"]), sum(len(p["regions"]) for p in result["pages"]), result["seconds"],
    )
    return result
