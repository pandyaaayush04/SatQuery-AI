"""Batch builder for Qwen-VL chat models. Loss only on the assistant answer."""
import torch


def chat_text(processor, prompt, n_images, answer=None):
    content = [{"type": "image"} for _ in range(n_images)] + [{"type": "text", "text": prompt}]
    text = processor.apply_chat_template([{"role": "user", "content": content}], tokenize=False, add_generation_prompt=True)
    return text if answer is None else text + answer + "<|im_end|>\n"


class Collator:
    def __init__(self, processor):
        self.p = processor
        self.answer_start = processor.tokenizer.encode("<|im_start|>assistant\n", add_special_tokens=False)

    def __call__(self, batch):
        texts = [chat_text(self.p, b["prompt"], len(b["images"]), b["answer"]) for b in batch]
        images = [im for b in batch for im in b["images"]]
        enc = self.p(text=texts, images=images, padding=True, return_tensors="pt")
        labels = enc["input_ids"].clone()
        labels[enc["attention_mask"] == 0] = -100
        k = len(self.answer_start)
        for i, ids in enumerate(enc["input_ids"].tolist()):
            for s in range(len(ids) - k, -1, -1):  # last assistant header = start of the answer
                if ids[s:s + k] == self.answer_start:
                    labels[i, :s + k] = -100
                    break
            else:
                raise ValueError("assistant header not found in sample")
        enc["labels"] = labels
        return enc
