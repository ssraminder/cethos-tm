"""Smoke test for a running OCR service.

Usage: python smoke_test.py <base_url> <api_key> <file> [<file> ...]

Checks the auth and input guards, then sends each file and prints a summary
(page count, region count, timing). It prints no document text.
"""

import sys

import httpx

base, key, files = sys.argv[1].rstrip("/"), sys.argv[2], sys.argv[3:]
ok = True


def check(name: str, passed: bool, detail: str = "") -> None:
    global ok
    ok = ok and passed
    print(f"{'PASS' if passed else 'FAIL'}  {name}  {detail}")


with httpx.Client(timeout=120) as c:
    r = c.get(f"{base}/healthz")
    check("healthz", r.status_code == 200 and r.json().get("ok") is True, str(r.status_code))
    r = c.post(f"{base}/ocr", content=b"%PDF-1.4")
    check("no key is refused", r.status_code == 401, str(r.status_code))
    r = c.post(f"{base}/ocr", content=b"%PDF-1.4", headers={"Authorization": "Bearer wrong"})
    check("wrong key is refused", r.status_code == 401, str(r.status_code))
    auth = {"Authorization": f"Bearer {key}"}
    r = c.post(f"{base}/ocr", content=b"hello world", headers=auth)
    check("unknown file type is refused", r.status_code == 415, str(r.status_code))
    r = c.post(f"{base}/ocr", content=b"", headers=auth)
    check("empty body is refused", r.status_code == 400, str(r.status_code))
    r = c.post(f"{base}/ocr", content=b"%PDF-1.4 not really a pdf", headers=auth)
    check("corrupt PDF is refused", r.status_code == 422, str(r.status_code))

    for path in files:
        data = open(path, "rb").read()
        r = c.post(f"{base}/ocr", content=data, headers=auth, params={"include_images": "true"})
        if r.status_code != 200:
            check(path, False, f"{r.status_code} {r.text[:120]}")
            continue
        body = r.json()
        regions = sum(len(p["regions"]) for p in body["pages"])
        shaped = all(
            len(reg["box"]) == 4 and len(reg["polygon"]) == 4 and 0 <= reg["confidence"] <= 1
            and reg["box"][2] <= p["width"] + 1 and reg["box"][3] <= p["height"] + 1
            for p in body["pages"] for reg in p["regions"]
        )
        images = all(p.get("image_jpeg_b64") for p in body["pages"])
        check(path.replace("\\", "/").split("/")[-1], regions > 0 and shaped and images,
              f"pages={len(body['pages'])} regions={regions} seconds={body['seconds']}")

sys.exit(0 if ok else 1)
