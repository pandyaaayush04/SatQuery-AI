"""QLoRA-tuned Qwen3-VL backend for satquery.controller.answer(vlm=...).

Loads the base model 4bit-quantized (same recipe as scripts/train_qlora.py) and applies the
trained adapter. Lazy-loads on first .ask() so importing this module (or the controller) never
pulls in torch/transformers unless a VLM is actually needed.
"""
import os
import threading
from contextlib import nullcontext

import torch

DEFAULT_MODEL = "Qwen/Qwen3-VL-4B-Instruct"
DEFAULT_ADAPTER = os.environ.get("SATQUERY_ADAPTER", "kaggle_outputs/run1/adapter")  # local path or a Hugging Face repo id


class QwenVLM:
    def __init__(self, adapter=DEFAULT_ADAPTER, model=DEFAULT_MODEL):
        self.adapter, self.model_id = adapter, model
        self._model = self._proc = None
        self._loading, self.error = False, None
        self._lock = threading.Lock()  # one generate() at a time on the single GPU; also stops two requests double-loading the model

    def _load(self):
        from transformers import AutoModelForImageTextToText, AutoProcessor, BitsAndBytesConfig

        self._proc = AutoProcessor.from_pretrained(self.model_id)
        self._proc.tokenizer.padding_side = "left"
        m = AutoModelForImageTextToText.from_pretrained(
            self.model_id, dtype=torch.float16, device_map={"": 0}, attn_implementation="sdpa",
            quantization_config=BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_quant_type="nf4", bnb_4bit_compute_dtype=torch.float16, llm_int8_skip_modules=["visual", "lm_head"]),
        )
        if self.adapter:
            from peft import PeftModel
            m = PeftModel.from_pretrained(m, self.adapter)
        self._model = m.eval()

    @property
    def ready(self):
        return self._model is not None

    def warm(self):
        """Load the model in a background thread (first run also downloads the base weights). Returns immediately; callers
        check .ready and answer without the model until it flips true, instead of freezing a request for minutes."""
        if self._model is not None or self._loading:
            return
        self._loading = True

        def run():
            try:
                with self._lock:
                    if self._model is None:
                        self._load()
                self.error = None
            except Exception as e:  # OOM, no network for the download, ...
                self.error = f"{type(e).__name__}: {str(e)[:160]}"
            finally:
                self._loading = False

        threading.Thread(target=run, daemon=True, name="vlm-warm").start()

    def ask(self, images, prompt, max_new_tokens=64):
        from satquery.collate import chat_text

        with self._lock:
            if self._model is None:
                self._load()
            text = chat_text(self._proc, prompt, len(images))
            enc = self._proc(text=[text], images=images, padding=True, return_tensors="pt").to("cuda")
            with torch.no_grad():
                out = self._model.generate(**enc, max_new_tokens=max_new_tokens, do_sample=False)
            return self._proc.tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).strip()

    def chat(self, messages, max_new_tokens=160):
        """Plain text conversation (no images). `messages` = [{"role": "system"|"user"|"assistant", "content": str}, ...].
        Runs with the LoRA adapter switched OFF: it was tuned for terse remote-sensing answers ("yes", "[0.1 0.2, ...]") and would
        make small talk curt; the base instruct model chats normally."""
        with self._lock:
            if self._model is None:
                self._load()
            msgs = [{"role": m["role"], "content": [{"type": "text", "text": m["content"]}]} for m in messages]
            text = self._proc.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True)
            enc = self._proc(text=[text], return_tensors="pt").to("cuda")
            off = self._model.disable_adapter() if hasattr(self._model, "disable_adapter") else nullcontext()
            with torch.no_grad(), off:
                out = self._model.generate(**enc, max_new_tokens=max_new_tokens, do_sample=True, temperature=0.7, top_p=0.9, repetition_penalty=1.05)
            return self._proc.tokenizer.decode(out[0][enc["input_ids"].shape[1]:], skip_special_tokens=True).strip()
