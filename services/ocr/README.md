# Cethos OCR service

Reads text out of images and scanned PDFs on infrastructure Cethos controls.
It exists so that client documents (driver's licences, birth certificates and
similar) are never sent to an outside OCR or AI provider.

- Engine: [RapidOCR](https://github.com/RapidAI/RapidOCR) with the PP-OCRv6
  small detection and recognition models. Code and these models are
  Apache-2.0 (see the `MODEL_LICENSES.md` shipped inside the `rapidocr`
  package).
- PDF rendering: `pypdfium2` (BSD-3-Clause / Apache-2.0).
- Runs on CPU. About 2 seconds per page in the November 2026 bake-off.
- Stores nothing and logs no document content, only sizes and timings.

## What it reads well, and what it does not

From the bake-off on 24 real documents:

- Good: printed Latin-script documents (Spanish and French licences, printed
  Spanish birth certificates).
- Not supported: Gurmukhi (Punjabi) script, handwriting, old typewritten
  forms, and Cyrillic with the default model.
- Confidence scores are not a safe error flag on their own: letter O and
  digit 0 were confused at 97-99% confidence. Use field rules as well.

## API

`POST /ocr` with the raw file bytes as the body (PDF, JPEG or PNG, up to
25 MB) and `Authorization: Bearer <OCR_API_KEY>`.

Query parameters:

- `include_images=true` also returns each page as a base64 JPEG, so the
  caller can display the page without rendering the PDF itself.
- `max_pages` (default 10, maximum 20); longer documents are refused.

Response:

```json
{
  "engine": "rapidocr",
  "model": "PP-OCRv6 small (det + rec)",
  "source_type": "pdf",
  "seconds": 1.9,
  "pages": [
    {
      "page": 1,
      "width": 1700,
      "height": 2200,
      "regions": [
        {
          "text": "PERMIS DE CONDUIRE",
          "confidence": 0.99,
          "box": [120.0, 80.5, 640.0, 131.0],
          "polygon": [[120.0, 80.5], [640.0, 82.0], [640.0, 131.0], [120.0, 129.5]]
        }
      ]
    }
  ]
}
```

Coordinates are pixels in the page image described by `width` and `height`,
with the origin at the top left. PDFs are rendered at 200 dpi and any page
is scaled down so its longest side is at most 2600 pixels.

`GET /healthz` returns `{"ok": true}` and needs no key.

## Configuration

| Variable | Purpose |
|---|---|
| `OCR_API_KEY` | Shared secret callers must send. If unset, `/ocr` refuses every request. |

## Run locally

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
OCR_API_KEY=local-dev-key uvicorn app:app --port 8080
python smoke_test.py http://127.0.0.1:8080 local-dev-key path/to/document.pdf
```

## Build the container

```bash
docker build -t cethos-ocr services/ocr
docker run -p 8080:8080 -e OCR_API_KEY=local-dev-key cethos-ocr
```
