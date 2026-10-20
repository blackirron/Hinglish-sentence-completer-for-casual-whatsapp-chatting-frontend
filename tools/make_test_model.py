"""Train a tiny GPT-2 on a few Hinglish lines and export it, to test the website without the real weights.

    python make_test_model.py            # writes web/public/models/test-tiny (git ignored)
    python make_test_model.py --small    # a GPT-2 small sized model with random weights, to measure size and speed

The words it produces are placeholders. This is only for plumbing and timing tests.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
import tempfile
from pathlib import Path

LINES = """kal main office jaa raha hu.
kal milte hain, timing confirm kar dena.
yaar tu kya kar raha hai?
mujhe lagta hai ki hum late ho jayenge.
bhai location bata dena, main aa raha hu.
aaj ka lecture kaisa tha?
mummy main aaj late aaunga.
thanks yaar, tune bahut help ki.
happy birthday bhai, party kab de raha hai?
haan yaar, main bhi wahi soch raha tha.
is weekend ka kya scene hai?
sorry yaar, aaj nahi ho payega.
kal ke notes bhej dena please.
main abhi ghar pe hu, tu bata.
wahh, yeh toh kamaal ho gaya!
exact time aur location send kar dena.
kya tum kal aa rahe ho?
hum kal milte hain aur plan final karte hain.
mujhe ek help chahiye, kal free ho kya?
thoda pehle bata dena yaar.""".split("\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--small", action="store_true")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "web/public/models/test-tiny"))
    args = ap.parse_args()

    import torch
    from tokenizers import Tokenizer, models, normalizers, pre_tokenizers, trainers
    from transformers import GPT2Config, GPT2LMHeadModel, PreTrainedTokenizerFast

    tk = Tokenizer(models.WordPiece(unk_token="[UNK]"))
    tk.normalizer = normalizers.BertNormalizer(lowercase=True)
    tk.pre_tokenizer = pre_tokenizers.BertPreTokenizer()
    size = 30522 if args.small else 400
    tk.train_from_iterator(LINES * 4, trainers.WordPieceTrainer(vocab_size=size, special_tokens=["[UNK]", "[PAD]"]))
    tk.add_special_tokens(["[EOS]"])
    fast = PreTrainedTokenizerFast(tokenizer_object=tk, unk_token="[UNK]", pad_token="[EOS]", eos_token="[EOS]")
    if args.small:  # pad the vocabulary to the real model's size
        fast.add_tokens([f"w{i}" for i in range(30523 - len(fast))])
    eos = fast.eos_token_id
    cfg = (GPT2Config(vocab_size=len(fast), n_layer=12, n_head=12, n_embd=768, n_positions=1024, bos_token_id=50256, eos_token_id=50256)
           if args.small else
           GPT2Config(vocab_size=len(fast), n_layer=2, n_head=2, n_embd=64, n_positions=128, bos_token_id=50256, eos_token_id=50256))
    model = GPT2LMHeadModel(cfg)  # stale ids on purpose, the exporter must repair them
    if not args.small:
        data = [fast(l + " ", add_special_tokens=False)["input_ids"] + [eos] for l in LINES]
        opt = torch.optim.AdamW(model.parameters(), lr=3e-3)
        torch.manual_seed(0)
        for step in range(500):
            for ids in data:
                x = torch.tensor([ids])
                loss = model(input_ids=x, labels=x).loss
                loss.backward()
            opt.step()
            opt.zero_grad()
            if step % 100 == 0:
                print("step", step, "loss", round(float(loss), 3))
    with tempfile.TemporaryDirectory() as tmp:
        model.save_pretrained(tmp)
        fast.save_pretrained(tmp)
        subprocess.run([sys.executable, str(Path(__file__).with_name("export_onnx.py")), "--model", tmp, "--out", args.out, "--min-agreement", "0.5"], check=True)


if __name__ == "__main__":
    main()
