
# complete.io inference API

FastAPI service that serves the int8 ONNX export of the fine tuned Hinglish GPT-2 (`blackirron/hinglish-gpt2-onnx`, made by `tools/export_onnx.py`). It runs on onnxruntime with no torch, so it fits in 512 MB of RAM (measured peak about 365 MB with a GPT-2 sized model).

| Endpoint | Auth | Purpose |
| --- | --- | --- |
| `GET /v1/health` | none | liveness and model loaded flag |
| `GET /v1/meta` | key | model info for the docs page |
| `POST /v1/next` | key | top k next words, prefix aware |
| `POST /v1/complete` | key | n completions, 1 to 3 sentences |

Send the shared secret in the `X-API-Key` header. The Vercel proxy adds it, browsers never see it.

## Run locally

    pip install -r requirements-dev.txt
    pytest                                  # fast, uses a stub model
    cp .env.example .env && set -a && . ./.env && set +a
    uvicorn app.main:app_factory --factory --port 8000

## Deploy on Render (free, no card)

1. Publish the ONNX package first (`tools/export_onnx.py ... --push blackirron/hinglish-gpt2-onnx`).
2. On render.com choose New, Blueprint, and pick this repo. `render.yaml` at the repo root does the rest and generates `API_SHARED_SECRET`.
3. When the build is done, open `https://<service>.onrender.com/v1/health` until it says `"status":"ok"`.
4. In Vercel set `NEXT_PUBLIC_ENGINE=server`, `INFERENCE_API_URL=https://<service>.onrender.com` and `API_SHARED_SECRET` (copy it from Render, Environment tab).

Free Render services sleep after 15 minutes without traffic and take about a minute to wake. The site pings health when it opens, which wakes the service while the visitor is still typing, and shows "Model waking up" until it is ready. The free plan has a small slice of a CPU, so expect completions to take a few seconds, not milliseconds.

## Settings

| Name | Required | Notes |
| --- | --- | --- |
| `API_SHARED_SECRET` | yes | 24+ random characters, same value goes in Vercel |
| `MODEL_REPO` / `MODEL_REVISION` | no | defaults to `blackirron/hinglish-gpt2-onnx` and `main`, pin a commit in production |
| `MODEL_DIR` | no | a local folder with the ONNX package, skips the Hub |
| `ORT_THREADS` | no | default 2, use 1 on Render free |
| `ORT_PREPACK` | no | set to `1` for about 2x faster generation at the cost of about 70 MB more RAM |
| `ALLOWED_ORIGINS` | no | only needed if a browser calls the API directly |
| `HF_TOKEN` | if repo is private | read token |
| `RATE_LIMIT_PER_MIN` | no | default 30 per end user |
| `BLOCKLIST_WORDS` | no | comma separated words hidden from output |

## Real model smoke test

Run once after the export, it needs network (or `MODEL_DIR`): `python scripts/smoke_test.py`.
