

# complete.io

**Hinglish sentences, completed for you.** Type half a message the way you would in WhatsApp and get the next word as you type, plus a few finished sentences to pick from. The model runs inside your browser, so what you write never leaves your device.

Live Demo: https://hinglish-sentence-completer-for-cas.vercel.app/

<p>
  <a href="https://huggingface.co/blackirron/hinglish-gpt2-finetuned">Model</a> ·
  <a href="https://huggingface.co/blackirron/hinglish-gpt2-onnx">Browser model (int8)</a> ·
  <a href="#measured-results">Results</a> ·
  <a href="#deploy">Deploy</a>
</p>

## What it does

- **Live next word.** Chips appear as you type. Leave the last word half typed and the chips finish it for you.
- **Sentence completion.** Get 2 to 4 finished suggestions, with controls for creativity (safe, balanced, playful) and length.
- **Copy, edit, star.** Tweak any suggestion before using it, save the good ones to My phrases, and find them again in History.
- **Private by design.** Inference runs on your device with WebAssembly. History and saved phrases live in your browser only, and there are no accounts.
- **Works in light and dark mode,** on desktop and phones.

## How it works

```
Browser
  Next.js page  ->  Web Worker  ->  Transformers.js + ONNX Runtime (WebAssembly)
                                      int8 GPT-2, about 110 MB, cached after the first visit
```

The base model is [`l3cube-pune/hing-gpt`](https://huggingface.co/l3cube-pune/hing-gpt), fine tuned on the [Hinglish Everyday Conversations 1M](https://huggingface.co/datasets/Abhishekcr448/Hinglish-Everyday-Conversations-1M) dataset of WhatsApp style dialogue. `tools/export_onnx.py` turns it into a small int8 ONNX package that the site downloads once.

An optional server mode serves the same ONNX package from a free Render instance, for people who would rather not download the model. See [Optional server mode](#optional-server-mode).

| Folder | What is in it |
| --- | --- |
| `web/` | Next.js 16 site, the in browser engine, unit tests |
| `tools/` | `export_onnx.py` (PyTorch to int8 ONNX), `benchmark.py`, `make_test_model.py` |
| `api/` | Optional FastAPI and onnxruntime server (no torch, fits in 512 MB) |
| `render.yaml` | One click Render setup for the optional server |

## Measured results

### Model quality

Held out chat text, 300 lines and 600 next word positions, seed 7. Reproduce with `tools/benchmark.py` (see [Benchmarks](#benchmarks)).

| Model | Perplexity ↓ | Bits per char ↓ | Top-1 ↑ | Top-3 ↑ | Top-5 ↑ | MRR ↑ | Keystroke savings ↑ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Fine tuned, fp32 | 12.15 | 0.774 | 39.8% | 58.8% | 64.5% | 0.496 | 82.2% |
| **Fine tuned, int8 (what the site uses)** | 12.17 | 0.775 | 39.7% | 58.2% | 64.2% | 0.493 | 82.1% |

What the columns mean: top-k is how often the word you were about to type is among the k chips shown, MRR rewards the right word sitting higher in the list, and keystroke savings is the share of characters you would not have to type if you tapped a chip as soon as the right word appeared.

The int8 model, which is 4 times smaller than fp32 (110 MB against 438 MB), gives up almost nothing: perplexity moves from 12.15 to 12.17 and top-5 accuracy by 0.3 points. It also runs about twice as fast on CPU (55 ms against 111 ms per next word call in Colab).

### Site

Measured on a 2 core sandbox with headless Chromium. Model timings use a GPT-2 sized int8 model with random weights, which has the real speed and memory but meaningless text.

| Check | Result |
| --- | --- |
| Lighthouse desktop (performance, accessibility, best practices, SEO) | 100 / 100 / 100 / 100 |
| Lighthouse mobile, simulated slow 4G | 90 / 100 / 100 / 100 |
| axe scan, WCAG 2.1 AA, 9 pages, light and dark, desktop and 390 px | 0 violations, no horizontal scroll |
| In browser model load and warm up | 6 to 17 s cold, about 2 s once cached |
| Next word chips | under 1 s including the typing pause |
| Three sentence completions | about 4 s worst case |
| Server mode, peak memory | about 365 MB |
| Tests | 17 web and 38 API, all passing |

## Quick start

```bash
cd web
npm install
npm run dev          # http://localhost:3000, downloads the model from Hugging Face on first use
```

Other commands: `npm test` (unit tests), `npm run lint`, `npx tsc --noEmit`, `npm run build`.

To work offline, build a small test model (placeholder text, for plumbing only) and point the site at it:

```bash
python tools/make_test_model.py
NEXT_PUBLIC_MODEL_SOURCE=local NEXT_PUBLIC_MODEL_ID=test-tiny npm run dev
```

## Deploy

The default setup is static pages on Vercel (free) with the model running in each visitor's browser. No server and no secrets.

1. **Export the model once.** In Colab (CPU is fine):
   ```bash
   pip install -q "transformers<5" optimum-onnx "optimum>=2" onnx onnxruntime huggingface_hub
   pip uninstall -y diffusers gradio gradio_client     # Colab extras that clash with the pin above
   python export_onnx.py --model blackirron/hinglish-gpt2-finetuned --out onnx_pkg --push blackirron/hinglish-gpt2-onnx
   ```
   Log in first with a write token (`from huggingface_hub import login; login()`). The script prints how closely the int8 model agrees with the original and writes `parity.json` for the next step.
2. **Import the repo in Vercel** with Root Directory `web`. No environment variables are required.
3. **Check the model.** Open `/diagnostics` on the live site and press Run the check. Every row of token ids must show a tick, which proves the browser reads Hinglish exactly like the original model.
4. Optional: run `web/scripts/security-check.sh https://<your-site>`.

Settings, all optional:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_MODEL_ID` | Model repo the browser downloads (default `blackirron/hinglish-gpt2-onnx`) |
| `NEXT_PUBLIC_MODEL_REVISION` | Commit to pin (defaults to the exported commit, so later pushes cannot change what visitors run) |
| `NEXT_PUBLIC_SITE_URL` | Public address, used for the sitemap and social preview |

### Optional server mode

For visitors who should not download 110 MB, serve the same package from a server. `api/` uses onnxruntime without torch, so it fits in Render's free 512 MB plan (no card needed).

1. On Render choose New, then Blueprint, and pick this repo. `render.yaml` sets everything up and generates `API_SHARED_SECRET`.
2. When the build finishes, open `https://<service>.onrender.com/v1/health` until it says `"status":"ok"`.
3. On Vercel set `NEXT_PUBLIC_ENGINE=server`, `INFERENCE_API_URL` and `API_SHARED_SECRET` (copy it from Render).

Free Render services sleep after 15 minutes idle and take about a minute to wake. The site pings the server when it opens and shows "Model waking up" until it is ready. Details are in `api/README.md`.

## Benchmarks

`tools/benchmark.py` measures perplexity, bits per character, next word top-1, top-3, top-5 and MRR (using the same whole word chips as the app), keystroke savings, completion variety and repetition, speed, and the int8 versus fp32 difference.

```bash
pip install -q "transformers<5" onnxruntime tokenizers huggingface_hub datasets
python tools/benchmark.py --data heldout.txt \
  --model "finetuned fp32=hf:blackirron/hinglish-gpt2-finetuned" \
  --model "finetuned int8=onnx:blackirron/hinglish-gpt2-onnx"
```

Use text the model never trained on, one chat message per line, otherwise every number looks better than it is. Perplexity is only comparable between models that share a tokenizer, so compare different families on bits per character.

## Privacy and security

- Browser mode has no backend: no prompts are sent, stored or logged, and there are no secrets to leak.
- Strict Content Security Policy: scripts only from this site, connections only to this site and Hugging Face for the model files. HSTS, frame, sniffing and referrer protection on every page.
- Cross origin isolation headers enable multi threaded WebAssembly. The WebAssembly runtime is served from this site, not a CDN.
- Server mode adds a constant time shared secret check, strict field whitelists on both layers, size caps, control and bidi character stripping, rate limits and a bounded request queue.

## Limitations

- The first visit downloads about 110 MB. It is cached afterwards, and the site asks before downloading on a metered connection.
- Phones run the model more slowly than laptops.
- Trained on synthetic WhatsApp style conversations, so very slangy or regional text may complete less naturally.
- Suggestions can be wrong or odd. Read before you send. A word blocklist is applied and can be extended in `web/src/lib/engine/config.ts`.
- Hindi in Devanagari script is not supported yet.

## Credits

Base model [`l3cube-pune/hing-gpt`](https://huggingface.co/l3cube-pune/hing-gpt) by L3Cube Pune. Fine tuning data from [Abhishekcr448/Hinglish-Everyday-Conversations-1M](https://huggingface.co/datasets/Abhishekcr448/Hinglish-Everyday-Conversations-1M). In browser inference by [Transformers.js](https://github.com/huggingface/transformers.js) and ONNX Runtime Web. Built with Next.js, Tailwind CSS and FastAPI.

## License

[MIT](LICENSE). Check the licences of the base model and dataset before reusing the weights.
