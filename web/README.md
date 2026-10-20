# complete.io web

Next.js 16 frontend for the Hinglish sentence completer. Read `AGENTS.md` first: this Next.js version has breaking changes, and the docs live in `node_modules/next/dist/docs`.

## Pages

| Route | What it does |
| --- | --- |
| `/` | Write a half message, live next word chips, options, Complete sentence |
| `/results` | Suggestions with copy, edit, star, Generate more, Shorter, Longer, change style |
| `/examples` | Starters by category, one click drops them into the box |
| `/phrases` | Starred lines |
| `/history` | Search, filter, reuse, delete |
| `/settings` | Defaults, theme, erase local data |
| `/about` | Model facts, limits, privacy |
| `/diagnostics` | Checks the browser model against the original (not indexed) |

## Run locally

    npm install
    npm run dev          # downloads the model from Hugging Face on first use
    npm test             # unit tests
    npm run lint && npx tsc --noEmit && npm run build

For an offline run use a local test model: `NEXT_PUBLIC_MODEL_SOURCE=local NEXT_PUBLIC_MODEL_ID=test-tiny` (build it with `../tools/make_test_model.py`).

## How the model is reached

Default (browser mode): a module Web Worker (`src/lib/engine/model.worker.ts`) loads the int8 ONNX model with Transformers.js and answers next word and sentence requests on the visitor's device. WebAssembly files are copied to `public/ort` at install. Cross origin isolation headers enable multi threaded WASM. Open `/diagnostics` to verify the tokenizer against the original model.

Server mode (`NEXT_PUBLIC_ENGINE=server`): the browser calls `/api/predict`, which checks origin, content type, size, rate limit and every field, then forwards a clean request to the FastAPI service with a shared secret. See `../README.md`.

## Checks

    scripts/security-check.sh https://your-site.vercel.app

## Data

No accounts and no server side storage. Settings, history and saved phrases live in this browser's localStorage and are validated again whenever they are read.
