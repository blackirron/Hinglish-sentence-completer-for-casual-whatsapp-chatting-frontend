"""Model wrapper. Runs the int8 ONNX export with onnxruntime, no torch, so it fits in 512 MB.

Loads once, serves next word candidates and completions. It mirrors the browser engine
(web/src/lib/engine/model.worker.ts) so both modes give the same kind of answers.
"""
from __future__ import annotations

import logging
import os
import re
import threading
import time
from pathlib import Path
from typing import Protocol

import numpy as np

from .textutil import (
    contains_blocked,
    cut_after_sentences,
    is_word_token,
    join_text,
    split_fragment,
)

log = logging.getLogger("complete.model")

TEMPERATURE = {"safe": 0.6, "balanced": 0.8, "playful": 1.0}
MODEL_FILE = "onnx/model_quantized.onnx"
SERVING_FILES = [MODEL_FILE, "config.json", "tokenizer.json"]
_SPACE_BEFORE_PUNCT = re.compile(r" +([.,!?;:])")


class Engine(Protocol):
    loaded: bool
    vocab_size: int | None

    def load(self) -> None: ...

    def next_words(self, prompt: str, k: int) -> list[tuple[str, float]]: ...

    def complete(
        self,
        prompt: str,
        n: int,
        sentences: int,
        max_new: int,
        creativity: str,
        seed: int | None,
    ) -> list[str]:
        """Return continuation strings (not including the prompt)."""
        ...


def _softmax(x: np.ndarray) -> np.ndarray:
    x = x - x.max(axis=-1, keepdims=True)
    e = np.exp(x)
    return e / e.sum(axis=-1, keepdims=True)


class OnnxEngine:
    def __init__(self, repo: str, revision: str | None = None, token: str | None = None,
                 blocklist: tuple[str, ...] = (), threads: int = 0, model_dir: str | None = None):
        self.repo, self.revision, self.token = repo, revision, token
        self.model_dir = model_dir
        self.blocklist = blocklist
        self.threads = threads
        self.loaded = False
        self.vocab_size: int | None = None
        self._lock = threading.Lock()

    # loading ---------------------------------------------------------------
    def load(self) -> None:
        import onnxruntime as ort
        from tokenizers import Tokenizer

        t0 = time.time()
        if self.model_dir:
            path = Path(self.model_dir)
        else:
            from huggingface_hub import snapshot_download

            path = Path(snapshot_download(
                self.repo, revision=self.revision, token=self.token, allow_patterns=SERVING_FILES))
        self.tok = Tokenizer.from_file(str(path / "tokenizer.json"))

        opts = ort.SessionOptions()
        opts.enable_cpu_mem_arena = False  # hands memory back instead of hoarding it
        opts.enable_mem_pattern = False
        if os.environ.get("ORT_PREPACK") != "1":  # default: about 70 MB less memory, roughly 2x slower
            opts.add_session_config_entry("session.disable_prepacking", "1")
        opts.intra_op_num_threads = self.threads if self.threads > 0 else 2
        opts.inter_op_num_threads = 1
        self.sess = ort.InferenceSession(str(path / MODEL_FILE), opts, providers=["CPUExecutionProvider"])

        inputs = {i.name: i for i in self.sess.get_inputs()}
        self._past = sorted(n for n in inputs if n.startswith("past_key_values."))
        self._has_pos = "position_ids" in inputs
        self._has_cache_flag = "use_cache_branch" in inputs
        first = inputs[self._past[0]]
        self._heads, self._dim = int(first.shape[1]), int(first.shape[3])
        self._present = [n.replace("past_key_values.", "present.") for n in self._past]

        vocab = self.tok.get_vocab()
        eos = vocab.get("[EOS]")
        if eos is None:
            raise RuntimeError("Tokenizer has no [EOS] token")
        self.eos = int(eos)
        # Probe once: the logits width must equal the tokenizer vocabulary.
        logits, _ = self._forward(np.array([[self.eos]], dtype=np.int64), None)
        rows = int(logits.shape[-1])
        if rows != self.tok.get_vocab_size() or self.eos >= rows:
            raise RuntimeError(
                f"Tokenizer and model disagree: eos={self.eos}, logits width={rows}, tokenizer size={self.tok.get_vocab_size()}"
            )
        self.vocab_size = rows
        self._special = {self.eos}
        for tok_text in ("[PAD]", "[UNK]", "[CLS]", "[SEP]", "[MASK]"):
            if tok_text in vocab:
                self._special.add(int(vocab[tok_text]))
        self._words = [""] * rows  # decoded pieces, filled lazily
        self._end_ids = np.array(
            sorted(i for t, i in vocab.items() if any(c in t for c in ".?!")), dtype=np.int64)
        self._is_end = np.zeros(rows, dtype=bool)
        self._is_end[self._end_ids] = True
        self.loaded = True
        log.info("model ready in %.1fs (vocab %s, eos %s)", time.time() - t0, rows, self.eos)
        self.complete("kal main", 1, 1, 8, "balanced", 0)  # warm up

    # model call ------------------------------------------------------------
    def _forward(self, ids: np.ndarray, past: list[np.ndarray] | None):
        batch, step = ids.shape
        done = 0 if past is None else past[0].shape[2]
        feed = {
            "input_ids": ids,
            "attention_mask": np.ones((batch, done + step), dtype=np.int64),
        }
        if self._has_pos:
            feed["position_ids"] = np.broadcast_to(
                np.arange(done, done + step, dtype=np.int64), (batch, step)).copy()
        if self._has_cache_flag:
            feed["use_cache_branch"] = np.array([past is not None])
        for i, name in enumerate(self._past):
            feed[name] = past[i] if past is not None else np.zeros(
                (batch, self._heads, 0, self._dim), dtype=np.float32)
        outs = self.sess.run(["logits", *self._present], feed)
        return outs[0], outs[1:]

    def _encode(self, text: str) -> list[int]:
        ids = self.tok.encode(text, add_special_tokens=False).ids if text else []
        return ids or [self.eos]

    def _piece(self, idx: int) -> str:
        w = self._words[idx]
        if not w:
            w = self.tok.decode([idx], skip_special_tokens=False).strip() or "\x00"
            self._words[idx] = w
        return "" if w == "\x00" else w

    def _decode(self, ids: list[int]) -> str:
        text = self.tok.decode(ids, skip_special_tokens=True)
        return _SPACE_BEFORE_PUNCT.sub(r"\1", text)

    # next word -------------------------------------------------------------
    def next_words(self, prompt: str, k: int) -> list[tuple[str, float]]:
        context, fragment = split_fragment(prompt)
        ids = np.array([self._encode(context)], dtype=np.int64)
        with self._lock:
            logits, _ = self._forward(ids, None)
        probs = _softmax(logits[0, -1].astype(np.float32))
        pool = min(600 if fragment else max(k * 6, 40), probs.shape[0])
        top = np.argpartition(-probs, pool - 1)[:pool]
        top = top[np.argsort(-probs[top])]
        out: list[tuple[str, float]] = []
        seen: set[str] = set()
        frag = fragment.lower()
        for idx in top.tolist():
            if idx in self._special:
                continue
            word = self._piece(idx)
            low = word.lower()
            if not word or not is_word_token(word) or low in seen:
                continue
            if frag and not low.startswith(frag):
                continue
            if contains_blocked(word, self.blocklist):
                continue
            seen.add(low)
            out.append((word, float(probs[idx])))
            if len(out) >= k:
                break
        return out

    # completion ------------------------------------------------------------
    def complete(self, prompt: str, n: int, sentences: int, max_new: int,
                 creativity: str, seed: int | None) -> list[str]:
        rng = np.random.default_rng(seed)
        temp = TEMPERATURE.get(creativity, 0.8)
        prompt_ids = self._encode(prompt)
        seqs = [list(prompt_ids) for _ in range(n)]
        gen: list[list[int]] = [[] for _ in range(n)]
        done = [False] * n
        deadline = time.time() + 25.0
        ids = np.array(seqs, dtype=np.int64)
        past = None
        with self._lock:
            for _ in range(max_new):
                logits, past = self._forward(ids, past)
                last = logits[:, -1].astype(np.float32)
                nxt = []
                for r in range(n):
                    if done[r]:
                        nxt.append(self.eos)
                        continue
                    tok = self._sample(last[r], seqs[r], temp, rng)
                    seqs[r].append(tok)
                    gen[r].append(tok)
                    nxt.append(tok)
                    ends = int(self._is_end[gen[r]].sum())
                    if tok == self.eos or ends >= sentences:
                        done[r] = True
                if all(done) or time.time() > deadline:
                    break
                ids = np.array(nxt, dtype=np.int64)[:, None]
        results: list[str] = []
        seen: set[str] = set()
        for row in gen:
            text = self._decode(row)
            text = cut_after_sentences(text, sentences).strip()
            key = text.lower()
            if not text or key in seen or contains_blocked(text, self.blocklist):
                continue
            seen.add(key)
            results.append(text)
        return results

    def _sample(self, logits: np.ndarray, history: list[int], temp: float, rng) -> int:
        logits = logits.copy()
        # repetition penalty 1.2 over everything seen so far (prompt included)
        seen = np.unique(np.array(history, dtype=np.int64))
        vals = logits[seen]
        logits[seen] = np.where(vals > 0, vals / 1.2, vals * 1.2)
        # no repeated bigrams: ban every token that already followed the last token
        last = history[-1]
        banned = [history[i + 1] for i in range(len(history) - 1) if history[i] == last]
        if banned:
            logits[banned] = -np.inf
        logits /= max(temp, 1e-4)
        k = 50
        cut = np.argpartition(-logits, k - 1)[:k]
        cut = cut[np.argsort(-logits[cut])]
        probs = _softmax(logits[cut])
        keep = np.cumsum(probs) - probs < 0.95  # nucleus: always keeps the top token
        cut, probs = cut[keep], probs[keep]
        probs = probs / probs.sum()
        return int(rng.choice(cut, p=probs))


def build_text(prompt: str, continuation: str) -> str:
    return join_text(prompt, continuation)
