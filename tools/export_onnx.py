"""Convert the fine tuned GPT-2 into the small ONNX package the website runs in the browser.

Run it in Colab (or anywhere with torch):

    pip install -q "transformers<5" optimum-onnx "optimum>=2" onnx onnxruntime huggingface_hub
    python export_onnx.py --model blackirron/hinglish-gpt2-finetuned --out onnx_pkg
    python export_onnx.py --model blackirron/hinglish-gpt2-finetuned --out onnx_pkg --push blackirron/hinglish-gpt2-onnx

What it does
  1. loads the model and checks tokenizer and embedding sizes agree
  2. rewrites the stale special token ids and use_cache so the package is safe to use as is
  3. exports an ONNX decoder with a key value cache, then quantises it to int8
  4. compares the quantised model with the original on sample text and prints the agreement
  5. writes parity.json (token ids from the real tokenizer) so the site's /diagnostics page can
     prove the browser tokenizer matches
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
from pathlib import Path

SAMPLES = [
    "kal main office",
    "Kal ka plan pakka hai na, bas mujhe",
    "yaar tu kya kar raha hai",
    "mujhe lagta hai ki",
    "Happy birthday bhai",
    "hum kal",
    "I am coming to college but",
]



def load_tokenizer(model: str):
    """Load the tokenizer. Repos saved by transformers 5 name a class (TokenizersBackend) that
    transformers 4 does not know, so fall back to building it straight from tokenizer.json."""
    from transformers import AutoTokenizer, PreTrainedTokenizerFast

    try:
        return AutoTokenizer.from_pretrained(model)
    except ValueError as exc:
        print(f"AutoTokenizer failed ({exc}); building the tokenizer from tokenizer.json instead")
    if Path(model).is_dir():
        path = Path(model) / "tokenizer.json"
    else:
        from huggingface_hub import hf_hub_download

        path = hf_hub_download(model, "tokenizer.json")
    base = PreTrainedTokenizerFast(tokenizer_file=str(path))
    vocab = base.get_vocab()
    names = {"eos_token": "[EOS]", "pad_token": "[PAD]", "unk_token": "[UNK]"}
    return PreTrainedTokenizerFast(tokenizer_file=str(path), **{k: v for k, v in names.items() if v in vocab})

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, help="Hub id or local folder of the fine tuned model")
    ap.add_argument("--out", default="onnx_pkg")
    ap.add_argument("--push", help="Hub repo id to upload the package to, for example user/hinglish-gpt2-onnx")
    ap.add_argument("--no-gather-quant", action="store_true", help="keep the embedding table in fp32 (bigger, safer)")
    ap.add_argument("--min-agreement", type=float, default=0.85)
    args = ap.parse_args()

    import numpy as np
    import onnxruntime as ort
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic
    from optimum.exporters.onnx import main_export
    from transformers import AutoModelForCausalLM, AutoTokenizer, GenerationConfig

    out = Path(args.out)
    if out.exists():
        shutil.rmtree(out)
    (out / "onnx").mkdir(parents=True)

    tok = load_tokenizer(args.model)
    model = AutoModelForCausalLM.from_pretrained(args.model).eval()
    rows = model.get_input_embeddings().weight.shape[0]
    eos = tok.eos_token_id if tok.eos_token_id is not None else tok.convert_tokens_to_ids("[EOS]")
    if eos is None or eos < 0 or eos >= rows or rows != len(tok):
        sys.exit(f"Tokenizer and model disagree: eos={eos} rows={rows} tokenizer={len(tok)}")
    print(f"vocab {len(tok)}  embedding rows {rows}  eos id {eos}")

    # Stale ids after a resize are a known trap, so write the right ones into the package.
    for cfg in (model.config, model.generation_config):
        cfg.eos_token_id = cfg.pad_token_id = cfg.bos_token_id = int(eos)
    model.config.use_cache = True
    model.generation_config.use_cache = True

    with tempfile.TemporaryDirectory() as tmp:
        src, exported = Path(tmp) / "src", Path(tmp) / "onnx"
        model.save_pretrained(src, safe_serialization=True)
        tok.save_pretrained(src)
        main_export(model_name_or_path=str(src), output=str(exported), task="text-generation-with-past", opset=18, do_validation=False)
        fp32 = exported / "model.onnx"
        print(f"fp32 onnx: {fp32.stat().st_size / 1e6:.0f} MB")
        ops = ["MatMul", "Gemm"] + ([] if args.no_gather_quant else ["Gather"])
        quant = out / "onnx" / "model_quantized.onnx"
        quantize_dynamic(str(fp32), str(quant), weight_type=QuantType.QInt8, op_types_to_quantize=ops)
        print(f"int8 onnx: {quant.stat().st_size / 1e6:.0f} MB  (download size for visitors)")

        for name in ("config.json", "tokenizer.json", "tokenizer_config.json", "special_tokens_map.json", "vocab.txt"):
            if (src / name).exists():
                shutil.copy(src / name, out / name)
        GenerationConfig(
            bos_token_id=int(eos), eos_token_id=int(eos), pad_token_id=int(eos), use_cache=True,
            do_sample=True, top_k=50, top_p=0.95, temperature=0.8, repetition_penalty=1.2, no_repeat_ngram_size=2,
        ).save_pretrained(out)

    # Compare int8 with the original: do they pick the same next token?
    sess = ort.InferenceSession(str(quant), providers=["CPUExecutionProvider"])
    names = {i.name for i in sess.get_inputs()}
    layers, heads = model.config.n_layer, model.config.n_head
    dim = model.config.n_embd // heads
    same = total = 0
    reference = []
    for text in SAMPLES:
        ids = tok(text, add_special_tokens=False)["input_ids"] or [int(eos)]
        with torch.inference_mode():
            logits = model(input_ids=torch.tensor([ids])).logits[0].float()
        feed = {"input_ids": np.array([ids], dtype=np.int64), "attention_mask": np.ones((1, len(ids)), dtype=np.int64)}
        if "position_ids" in names:
            feed["position_ids"] = np.arange(len(ids), dtype=np.int64)[None]
        if "use_cache_branch" in names:
            feed["use_cache_branch"] = np.array([False])
        for layer in range(layers):
            for kind in ("key", "value"):
                feed[f"past_key_values.{layer}.{kind}"] = np.zeros((1, heads, 0, dim), dtype=np.float32)
        q_logits = sess.run(["logits"], feed)[0][0]
        same += int((q_logits.argmax(-1) == logits.numpy().argmax(-1)).sum())
        total += len(ids)
        probs = torch.softmax(logits[-1], -1)
        top = torch.topk(probs, 5)
        reference.append({"text": text, "ids": ids, "next": [[tok.decode([int(i)]).strip(), round(float(p), 4)] for p, i in zip(top.values, top.indices)]})
    agreement = same / max(total, 1)
    print(f"int8 vs original, same top token on {same}/{total} positions ({agreement:.0%})")
    (out / "parity.json").write_text(json.dumps({"eos": int(eos), "vocab": rows, "samples": reference}, ensure_ascii=False, indent=1))
    if agreement < args.min_agreement:
        print("WARNING: agreement is low. Re run with --no-gather-quant, or check the model.")

    total_mb = sum(f.stat().st_size for f in out.rglob("*") if f.is_file()) / 1e6
    print(f"package in {out}/ ({total_mb:.0f} MB)")
    if args.push:
        from huggingface_hub import HfApi

        api = HfApi()
        api.create_repo(args.push, repo_type="model", exist_ok=True)
        api.upload_folder(folder_path=str(out), repo_id=args.push, repo_type="model", commit_message="ONNX int8 package for in browser use")
        print(f"uploaded. Pin this commit in NEXT_PUBLIC_MODEL_REVISION: https://huggingface.co/{args.push}/commits/main")
    return 0 if agreement >= args.min_agreement else 2


if __name__ == "__main__":
    raise SystemExit(main())
