"""The model, the four cache methods, and the timing loop used by the server's benchmark."""

from __future__ import annotations

import copy
import os
import statistics
import subprocess
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, DynamicCache, StaticCache

MODEL_ID = "Qwen/Qwen3.5-0.8B"
# Pinned so the server and the website's tokenizer (web/src/qwen/model.ts) always use the same files.
MODEL_REVISION = "2fc06364715b967f1860aea9cf38778875588b17"
MIB = 1024 * 1024
# Answers run until the model says it's done. This only stops a model that never does.
SAFETY_STOP = 1024
# "No cache" gets slower with every token (it re-reads the whole sequence each time), so in the
# benchmark it is timed on the first tokens of each answer only. That understates its real cost.
NO_CACHE_TOKENS = 16
# Tokens generated, untimed, so the GPU has prepared its kernels before anything is measured.
WARM_UP_TOKENS = 2

# The methods visitors can compare. "no_cache" is the reference every other method is checked against.
METHODS = ("no_cache", "dynamic", "static", "prefix_sharing")


class Cancelled(Exception):
    """Raised when a run is stopped early (the visitor clicked Stop or left)."""


# ---------------------------------------------------------------------------
# Device
# ---------------------------------------------------------------------------

def pick_device() -> str:
    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def sync(device: str) -> None:
    """GPU work is asynchronous: wait for it so timers measure the work, not just the launch."""
    if device == "cuda":
        torch.cuda.synchronize()
    elif device == "mps":
        torch.mps.synchronize()


def allocated_bytes(device: str) -> int:
    if device == "cuda":
        return torch.cuda.memory_allocated()
    if device == "mps":
        return torch.mps.current_allocated_memory()
    return 0


def gpu_name(device: str) -> str:
    if device == "cuda":
        return torch.cuda.get_device_properties(0).name
    if device == "mps":
        try:
            chip = subprocess.run(["sysctl", "-n", "machdep.cpu.brand_string"], capture_output=True, text=True).stdout.strip()
        except OSError:
            chip = ""
        return f"{chip or 'Apple silicon'} GPU"
    return f"CPU ({os.cpu_count()} cores, no GPU)"


# ---------------------------------------------------------------------------
# One generation, timed
# ---------------------------------------------------------------------------

@dataclass
class Run:
    prompt_tokens: int
    cached_tokens: int
    ttft_ms: float
    decode_ms: list[float]
    kv_bytes: int
    peak_bytes: int
    tokens: list[int]
    # True if the model ended its answer itself; False if the safety stop cut it off.
    finished: bool


def kv_bytes(cache) -> int:
    """Bytes of keys and values a cache holds (attention layers only)."""
    total = 0
    for layer in getattr(cache, "layers", []) if cache is not None else []:
        for name in ("keys", "values"):
            tensor = getattr(layer, name, None)
            if torch.is_tensor(tensor):
                total += tensor.numel() * tensor.element_size()
    return total


class PrefixStore:
    """Caches saved at the end of the system prompt, so later questions with the same system prompt reuse them."""

    def __init__(self) -> None:
        self.snapshots: dict[tuple[int, ...], Any] = {}

    def lookup(self, ids: list[int]) -> tuple[int, Any]:
        for key, cache in self.snapshots.items():
            if len(key) < len(ids) and tuple(ids[: len(key)]) == key:
                return len(key), copy.deepcopy(cache)
        return 0, None


class Lab:
    def __init__(self, model_id: str = MODEL_ID, revision: str = MODEL_REVISION) -> None:
        self.device = pick_device()
        self.model_id = model_id
        self.tokenizer = AutoTokenizer.from_pretrained(model_id, revision=revision)
        self.model = AutoModelForCausalLM.from_pretrained(model_id, revision=revision, dtype=torch.bfloat16).to(self.device).eval()
        self.gpu = gpu_name(self.device)
        # Tokens that end an answer (for Qwen: <|im_end|> and <|endoftext|>).
        eos = self.model.generation_config.eos_token_id
        self.stop_ids = set(eos if isinstance(eos, list) else [eos]) | {self.tokenizer.eos_token_id}

    # -- prompts ------------------------------------------------------------

    def prompt_ids(self, system: str, question: str) -> list[int]:
        """The chat template, exactly as the website's tokenizer applies it (thinking off)."""
        messages = ([{"role": "system", "content": system}] if system.strip() else []) + [{"role": "user", "content": question}]
        text = self.tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        return self.tokenizer(text, add_special_tokens=False).input_ids

    def system_length(self, system: str) -> int:
        """Tokens every question with this system prompt starts with."""
        a, b = self.prompt_ids(system, "a"), self.prompt_ids(system, "b")
        n = 0
        while n < min(len(a), len(b)) and a[n] == b[n]:
            n += 1
        return n

    # -- generation ---------------------------------------------------------

    def _forward(self, ids: torch.Tensor, cache):
        # logits_to_keep=1: only the last position's scores are needed to pick the next token.
        if cache is None:
            return self.model(ids, use_cache=False, logits_to_keep=1).logits[:, -1]
        return self.model(ids, past_key_values=cache, use_cache=True, logits_to_keep=1).logits[:, -1]

    def answer_text(self, tokens: list[int]) -> str:
        return self.tokenizer.decode([t for t in tokens if t not in self.stop_ids])

    @torch.no_grad()
    def generate(self, ids: list[int]) -> list[int]:
        """The whole greedy answer, untimed (for the lesson). The end-of-answer token is left out."""
        out = self.model.generate(torch.tensor([ids], device=self.device), max_new_tokens=SAFETY_STOP, do_sample=False)
        return [t for t in out[0, len(ids):].tolist() if t not in self.stop_ids]

    @torch.no_grad()
    def timed_run(self, method: str, ids: list[int], store: PrefixStore | None, system_len: int,
                  should_stop: Callable[[], bool], max_new: int = SAFETY_STOP,
                  on_token: Callable[[int], None] | None = None) -> Run:
        """Greedy decoding with one cache method until the answer ends. The first token and each later token are timed separately."""
        input_ids = torch.tensor([ids], device=self.device)
        if self.device == "cuda":
            torch.cuda.reset_peak_memory_stats()
        sync(self.device)
        start = time.perf_counter()
        saving = 0.0  # time spent saving a prefix snapshot: bookkeeping, not part of the method's cost

        cached, cache = 0, None
        if method == "no_cache":
            logits = self._forward(input_ids, None)
        else:
            if method == "static":
                # A static cache must reserve room for the longest answer it might produce.
                cache = StaticCache(config=self.model.config, max_cache_len=len(ids) + max_new)
            elif store is not None:
                cached, cache = store.lookup(ids)
            cache = cache if cache is not None else DynamicCache(config=self.model.config)

            pos = cached
            if store is not None and cached == 0 and 0 < system_len < len(ids):
                # First question with this system prompt: compute the system part, save it, then the rest.
                self._forward(input_ids[:, :system_len], cache)
                sync(self.device)
                t = time.perf_counter()
                store.snapshots[tuple(ids[:system_len])] = copy.deepcopy(cache)
                saving += time.perf_counter() - t
                pos = system_len
            logits = self._forward(input_ids[:, pos:], cache)

        token = logits.argmax(-1)
        sync(self.device)
        ttft = time.perf_counter() - start - saving
        peak = allocated_bytes(self.device)

        tokens = [int(token.item())]
        if on_token:
            on_token(tokens[-1])
        decode: list[float] = []
        seq = input_ids
        while tokens[-1] not in self.stop_ids and len(tokens) < max_new:
            if should_stop():
                raise Cancelled
            t = time.perf_counter()
            if cache is None:  # no cache: run the whole sequence again
                seq = torch.cat([seq, token[:, None]], dim=1)
                logits = self._forward(seq, None)
            else:  # cache: feed only the newest token
                logits = self._forward(token[:, None], cache)
            token = logits.argmax(-1)
            sync(self.device)
            decode.append((time.perf_counter() - t) * 1000)
            tokens.append(int(token.item()))
            if on_token:  # outside the timer: streaming the token to the page isn't the method's cost
                on_token(tokens[-1])

        peak = torch.cuda.max_memory_allocated() if self.device == "cuda" else max(peak, allocated_bytes(self.device))
        return Run(len(ids), cached, ttft * 1000, decode, kv_bytes(cache), peak, tokens, tokens[-1] in self.stop_ids)

    # -- race (Learn page) ---------------------------------------------------

    def race(self, system: str, question: str) -> dict[str, Any]:
        """The whole answer with no cache and with a KV cache, each token timed, after an untimed warm-up."""
        ids = self.prompt_ids(system, question)
        never = lambda: False  # noqa: E731
        for method in ("no_cache", "dynamic"):
            self.timed_run(method, ids, None, 0, never, max_new=4)
        result: dict[str, Any] = {"gpu": self.gpu, "prompt_tokens": len(ids)}
        for method in ("no_cache", "dynamic"):
            run = self.timed_run(method, ids, None, 0, never)
            result[method] = [
                {"text": "" if t in self.stop_ids else self.tokenizer.decode([t]), "ms": round(ms, 2)}
                for t, ms in zip(run.tokens, [run.ttft_ms, *run.decode_ms])
            ]
        return result

    # -- benchmark ----------------------------------------------------------

    def benchmark(self, system: str, questions: list[str], repeats: int,
                  emit: Callable[[dict[str, Any]], None], should_stop: Callable[[], bool]) -> dict[str, Any]:
        """A short untimed warm-up, then `repeats` measured passes with methods taking turns going first."""
        prompts = [self.prompt_ids(system, q) for q in questions]
        system_len = self.system_length(system) if system.strip() else 0
        limit = {m: NO_CACHE_TOKENS if m == "no_cache" else SAFETY_STOP for m in METHODS}

        for method in METHODS:  # warm-up: a few tokens per method and prompt length
            for ids in prompts:
                self.timed_run(method, ids, None, 0, should_stop, max_new=WARM_UP_TOKENS)

        total, done = repeats * len(METHODS) * len(prompts), 0
        runs: dict[str, list[list[Run]]] = {m: [] for m in METHODS}
        for p in range(repeats):
            order = METHODS[p % len(METHODS):] + METHODS[: p % len(METHODS)]
            for method in order:
                store = PrefixStore() if method == "prefix_sharing" else None
                results = []
                for q, ids in enumerate(prompts):
                    emit({"type": "start", "method": method, "question": q, "pass": p + 1, "done": done, "total": total})
                    on_token = lambda t, m=method, q=q: emit({"type": "token", "method": m, "question": q, "text": "" if t in self.stop_ids else self.tokenizer.decode([t])})  # noqa: E731
                    results.append(self.timed_run(method, ids, store, system_len, should_stop, limit[method], on_token))
                    done += 1
                runs[method].append(results)

        return {
            "model": self.model_id,
            "gpu": self.gpu,
            "repeats": repeats,
            "no_cache_tokens": NO_CACHE_TOKENS,
            "date": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "prompt_tokens": [len(ids) for ids in prompts],
            "methods": [summarize(m, runs[m], runs["no_cache"][-1], self.answer_text) for m in METHODS],
        }


def percentile(values: list[float], q: float) -> float:
    ordered = sorted(values)
    k = (len(ordered) - 1) * q / 100
    lo, hi = int(k), min(int(k) + 1, len(ordered) - 1)
    return ordered[lo] + (ordered[hi] - ordered[lo]) * (k - lo)


def first_difference(a: list[int], b: list[int]) -> int | None:
    """Index of the first token where two answers differ; None if they are identical."""
    for i, (x, y) in enumerate(zip(a, b)):
        if x != y:
            return i
    return None if len(a) == len(b) else min(len(a), len(b))


def summarize(method: str, passes: list[list[Run]], baseline: list[Run], answer_text: Callable[[list[int]], str]) -> dict[str, Any]:
    """passes[repeat][question] -> one summary row."""
    flat = [run for p in passes for run in p]
    last = passes[-1]
    ttft = [r.ttft_ms for r in flat]
    # "No cache" only produced the start of each answer, so compare that much.
    differences = [first_difference(r.tokens, b.tokens) if b.finished else first_difference(r.tokens[: len(b.tokens)], b.tokens)
                   for r, b in zip(last, baseline)]
    found = [d for d in differences if d is not None]
    return {
        "method": method,
        "ttft_ms_p50": round(percentile(ttft, 50), 2),
        "ttft_ms_p95": round(percentile(ttft, 95), 2),
        "ms_per_token": round(statistics.median(statistics.mean(r.decode_ms) for r in flat if r.decode_ms), 2),
        "kv_cache_mib": round(statistics.median(r.kv_bytes for r in last) / MIB, 3),
        "peak_memory_mib": round(max(r.peak_bytes for r in flat) / MIB, 1),
        "reused_fraction": round(sum(r.cached_tokens for r in last) / sum(r.prompt_tokens for r in last), 4),
        "matches_no_cache": None if method == "no_cache" else not found,
        "first_difference": min(found) if found else None,
        "per_question": [
            {
                "prompt_tokens": runs[0].prompt_tokens,
                "cached_tokens": runs[-1].cached_tokens,
                "ttft_ms": round(statistics.median(r.ttft_ms for r in runs), 2),
                "ms_per_token": round(statistics.median(statistics.mean(r.decode_ms) for r in runs if r.decode_ms), 2) if runs[0].decode_ms else None,
                "answer": answer_text(runs[-1].tokens),
                "answer_tokens": len(runs[-1].tokens),
                "finished": runs[-1].finished,
            }
            for runs in zip(*passes)
        ],
    }
