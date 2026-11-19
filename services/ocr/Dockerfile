FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

# Runtime libraries needed by OpenCV and ONNX Runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libglib2.0-0 libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Load the engine once at build time so the model files are inside the image
# and the running container never downloads anything.
RUN python -c "from rapidocr import RapidOCR; RapidOCR()"

COPY app.py .

RUN useradd --create-home --uid 10001 ocr
USER ocr

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "1"]
