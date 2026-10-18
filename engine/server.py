"""Runs the real model for the website.

  GET  /api/health     is the server up, and on which GPU
  POST /api/generate   the model's answer to a prompt, as tokens (the Learn page shows it)
  POST /api/suggest    the model writes a question that fits the visitor's system prompt
  POST /api/race       the whole answer with no cache and with a KV cache, every token timed (the Learn page replays it)
  POST /api/benchmark  time every cache method on the visitor's prompts; streams progress, then the result

With --site, it also serves the built website (web/dist), so one process runs everything:
  python server.py --site ../web/dist                       # site and API on http://127.0.0.1:8000

Usage:
  python server.py                                          # API only, for `npm run dev`
  python server.py --host 0.0.0.0 --origins https://your-site.example
"""

from __future__ import annotations

import argparse
import asyncio
import json
import threading
from pathlib import Path
from typing import Any

import torch
import uvicorn
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from lab import Cancelled, Lab

MAX_PROMPT_TOKENS = 1024


class GenerateBody(BaseModel):
    system: str = Field("", max_length=4000)
    question: str = Field(..., min_length=1, max_length=4000)


class RaceBody(GenerateBody):
    pass


class SuggestBody(BaseModel):
    system: str = Field("", max_length=4000)


class BenchmarkBody(BaseModel):
    system: str = Field("", max_length=4000)
    questions: list[str] = Field(..., min_length=1, max_length=4)
    repeats: int = Field(1, ge=1, le=3)


def create_app(lab: Lab, origins: list[str], site: Path | None = None) -> FastAPI:
    app = FastAPI(title="KV Playground")
    app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["GET", "POST"], allow_headers=["*"])
    gpu = threading.Lock()  # one job on the GPU at a time

    def prompt_ids(system: str, question: str) -> list[int]:
        ids = lab.prompt_ids(system, question)
        if len(ids) > MAX_PROMPT_TOKENS:
            raise HTTPException(400, f"That prompt is {len(ids):,} tokens; the limit is {MAX_PROMPT_TOKENS:,}.")
        return ids

    @app.get("/api/health")
    def health() -> dict[str, Any]:
        return {"model": lab.model_id, "gpu": lab.gpu, "busy": gpu.locked()}

    @app.post("/api/generate")
    def generate(body: GenerateBody) -> dict[str, Any]:
        ids = prompt_ids(body.system, body.question)
        with gpu:
            tokens = lab.generate(ids)
        return {"tokens": [{"id": i, "text": lab.tokenizer.decode([i]), "special": False} for i in tokens]}

    @app.post("/api/race")
    def race(body: RaceBody) -> dict[str, Any]:
        prompt_ids(body.system, body.question)
        with gpu:
            return lab.race(body.system, body.question)

    @app.post("/api/suggest")
    def suggest(body: SuggestBody) -> dict[str, str]:
        """A question that fits the visitor's system prompt, written by the model itself."""
        if body.system.strip():
            request = (f'Write one short, specific question that someone would ask an assistant described as: "{body.system.strip()}" '
                       "Reply with only the question.")
        else:
            request = "Write one short, specific question someone might ask a helpful AI assistant about everyday life. Reply with only the question."
        ids = lab.prompt_ids("", request)
        question = ""
        with gpu, torch.no_grad():
            for _ in range(3):  # a small model sometimes replies with something that isn't a question; try again
                out = lab.model.generate(torch.tensor([ids], device=lab.device), max_new_tokens=48, do_sample=True, temperature=0.8, top_p=0.95)
                lines = lab.tokenizer.decode(out[0, len(ids):], skip_special_tokens=True).strip().strip('"').splitlines()
                question = lines[0].strip() if lines else ""
                if question.endswith("?"):
                    break
        return {"question": question}

    @app.post("/api/benchmark")
    async def benchmark(body: BenchmarkBody, request: Request) -> StreamingResponse:
        questions = [q for q in (q.strip() for q in body.questions) if q]
        if not questions:
            raise HTTPException(400, "Write at least one question.")
        for q in questions:
            prompt_ids(body.system, q)

        loop = asyncio.get_running_loop()
        events: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        stop = threading.Event()

        def emit(event: dict[str, Any] | None) -> None:
            loop.call_soon_threadsafe(events.put_nowait, event)

        def work() -> None:
            try:
                if gpu.locked():
                    emit({"type": "queued"})
                with gpu:
                    result = lab.benchmark(body.system, questions, body.repeats, emit=emit, should_stop=stop.is_set)
                emit({"type": "result", "data": result})
            except Cancelled:
                pass
            except Exception as error:  # show it on the page instead of silently ending the stream
                emit({"type": "error", "message": f"{type(error).__name__}: {error}"})
            finally:
                emit(None)

        threading.Thread(target=work, daemon=True).start()

        async def stream():
            # Server-Sent Events: one "data: {json}" line per event.
            try:
                while True:
                    if await request.is_disconnected():
                        return
                    try:
                        event = await asyncio.wait_for(events.get(), timeout=1.0)
                    except asyncio.TimeoutError:
                        continue
                    if event is None:
                        return
                    yield f"data: {json.dumps(event)}\n\n"
            finally:
                stop.set()

        return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

    if site is not None:
        # The website: built files under /assets, and index.html for every page route (/, /benchmarks, …).
        app.mount("/assets", StaticFiles(directory=site / "assets"), name="assets")

        @app.get("/{path:path}", include_in_schema=False)
        def page(path: str) -> FileResponse:
            file = (site / path).resolve()
            if path and file.is_file() and site.resolve() in file.parents:
                return FileResponse(file)
            return FileResponse(site / "index.html")

    return app


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--origins", nargs="*", default=["http://localhost:5173", "http://localhost:4173"],
                        help="other websites allowed to call this server")
    parser.add_argument("--site", type=Path, default=None, help="folder of the built website to serve (web/dist)")
    args = parser.parse_args()

    print("Loading the model…", flush=True)
    lab = Lab()
    print(f"Ready on http://{args.host}:{args.port} ({lab.gpu})", flush=True)
    if args.site and not (args.site / "index.html").is_file():
        parser.error(f"{args.site} has no index.html; build the site first (cd web && npm run build)")
    uvicorn.run(create_app(lab, args.origins, args.site), host=args.host, port=args.port, log_level="warning")


if __name__ == "__main__":
    main()
