# complete.io

Hinglish sentence completer. Type half a message, get next words and finished sentences from a fine tuned GPT-2 (`blackirron/hinglish-gpt2-finetuned`).

    web/    Next.js 16 site. By default the model runs inside the visitor's browser.
    tools/  export_onnx.py turns the PyTorch model into a small int8 ONNX package
    api/    Optional FastAPI + onnxruntime server (Render free plan, see render.yaml)

## How it runs for free

Hugging Face Docker Spaces and most free servers cannot hold a GPT-2 model without a paid plan or a card. So the default mode needs no server at all. The site is static pages on Vercel (free) and the browser downloads an int8 copy of the model (about 112 MB, once, then cached) and runs it with Transformers.js and WebAssembly. Nothing the visitor types is sent anywhere, and there is no secret to protect or API to attack.

Trade offs to know about: the first visit has a download, and phones are slower than laptops. The site asks before downloading on a metered connection.

## Launch steps

1. Export the model. Open a Colab notebook (CPU is fine) and run:

        pip install -q "transformers<5" optimum-onnx "optimum>=2" onnx onnxruntime huggingface_hub
        python export_onnx.py --model blackirron/hinglish-gpt2-finetuned --out onnx_pkg --push blackirron/hinglish-gpt2-onnx

   Log in first with `huggingface-cli login` (a write token). The script prints how often the int8 model agrees with the original. Below 85 percent it warns, and you can re run with `--no-gather-quant`. It also writes `parity.json` for the check in step 4.

2. Optional: note the commit hash of the new repo (Files, History) so you can pin it.
3. Import this repo in Vercel with Root Directory `web`. No environment variables are required. Recommended:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_MODEL_ID` | `blackirron/hinglish-gpt2-onnx` (the default) |
   | `NEXT_PUBLIC_MODEL_REVISION` | already defaults to the commit that was exported (8357f2d), set it only after you push a new export |

4. Open `https://<your-site>/diagnostics` once and press Run the check. Every row of token ids must be ticked. This is the one thing I could not test without network access to Hugging Face: that the browser tokenizer reads Hinglish exactly like the original.
5. Run `web/scripts/security-check.sh https://<your-site>`.

## Run locally

    cd web && npm install && npm run dev

The first load downloads the model from Hugging Face. To work offline, build a small test model with `python tools/make_test_model.py` and start with `NEXT_PUBLIC_MODEL_SOURCE=local NEXT_PUBLIC_MODEL_ID=test-tiny`.

Tests: `cd web && npm test` (unit), `cd api && pytest` (server mode).

## Optional server mode (Render, free, no card)

If you would rather have no download for visitors, run the model on a server. `api/` serves the same int8 ONNX package with onnxruntime and fits in Render's free 512 MB. In Render choose New, Blueprint and pick this repo (`render.yaml` is at the root). Then on Vercel set `NEXT_PUBLIC_ENGINE=server`, `INFERENCE_API_URL` and `API_SHARED_SECRET` (copy it from Render). Free Render sleeps after 15 minutes idle and takes about a minute to wake. Details in `api/README.md`.

## Measured results

Measured on a 2 core sandbox with headless Chromium, using a GPT-2 sized int8 model with random weights (same speed and memory as the real one, but its output is meaningless). The real model's text quality is checked with `/diagnostics` and the export script's agreement line (94 percent on the 33 test positions).

| What | Result |
| --- | --- |
| Lighthouse, desktop, home and about | 100 / 100 / 100 / 100 (performance, accessibility, best practices, SEO) |
| Lighthouse, mobile (simulated slow 4G), home | 90 performance, 100 accessibility, 100 best practices, 100 SEO |
| axe accessibility scan, WCAG 2.1 AA, 9 pages, light and dark, desktop and 390 px | 0 violations, no horizontal scroll |
| Browser engine, model load and warm up | 6 to 17 s on a cold start (from localhost) |
| Browser engine, next word chips | under 1 s including the typing pause |
| Browser engine, 3 sentence completions | about 4.3 s worst case (the test model never ends a sentence, so it always runs to the token limit) |
| Server engine (`api/`), peak memory | about 365 MB (fits Render free 512 MB) |
| Server engine, 4 completions of 60 tokens | about 1.8 s on this sandbox, slower on Render free |
| Unit and API tests | 17 web, 38 api, all passing |

## Security notes

- Browser mode: no backend, no stored prompts, no secrets. History and saved phrases stay in localStorage.
- Strict CSP: scripts only from this site (plus inline and wasm as Next.js and WebAssembly need), connections only to this site and Hugging Face for the model files. HSTS, frame, sniffing and referrer protection, and cross origin isolation headers on every page.
- WebAssembly runtime files are served from this site, not a CDN.
- Pin the model revision in production so the model files cannot change underneath you.
- Server mode: secret compared in constant time, strict field whitelists on both layers, size caps, control and bidi stripping, rate limits on both layers, one generation at a time with a short queue, prompts never logged.
