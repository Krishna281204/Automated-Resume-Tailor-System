"""
main.py — FastAPI application for the Agentic AI LaTeX Resume Tailor.

Endpoints:
  POST /api/tailor      — Accept JD, ZIP, instructions; run agent; return job_id
  GET  /api/status/{job_id} — SSE stream of status updates
  GET  /api/download/{job_id} — Download the compiled PDF
  GET  /api/tex/{job_id}     — Download a ZIP of modified .tex files (fallback)
"""

import os
import uuid
import asyncio
import logging
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import AsyncGenerator

import aiofiles
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from sse_starlette.sse import EventSourceResponse

from agent.graph import tailor_graph
from agent.state import AgentState
from agent.tools import extract_pdf_text

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

load_dotenv()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Agentic AI LaTeX Resume Tailor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# In-memory job store  (for a production app, use Redis or a database)
# ---------------------------------------------------------------------------

jobs: dict[str, dict] = {}
# job entry structure:
# {
#   "status": "running" | "done" | "error",
#   "updates": [str, ...],
#   "pdf_path": str | None,
#   "source_dir": str | None,
#   "work_dir": str,
#   "error": str | None,
#   "modification_summary": str | None,
#   "queue": asyncio.Queue   # SSE events
# }


# ---------------------------------------------------------------------------
# Background worker
# ---------------------------------------------------------------------------

async def run_agent(job_id: str, initial_state: AgentState) -> None:
    """Run the LangGraph agent in a thread pool and feed results into the job store."""
    queue: asyncio.Queue = jobs[job_id]["queue"]

    async def emit(msg: str):
        jobs[job_id]["updates"].append(msg)
        await queue.put({"event": "update", "data": msg})

    await emit("🚀 Starting resume tailoring agent...")

    try:
        # LangGraph invoke is synchronous; run in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        final_state: AgentState = await loop.run_in_executor(
            None,
            lambda: tailor_graph.invoke(initial_state),
        )

        # Forward any status updates from the state
        for update in final_state.get("status_updates", [])[len(initial_state.get("status_updates", [])):]:
            await emit(update)

        # Also emit all updates from final state (they may not have been forwarded)
        for update in final_state.get("status_updates", []):
            if update not in jobs[job_id]["updates"]:
                await emit(update)

        if final_state.get("error"):
            jobs[job_id]["status"] = "error"
            jobs[job_id]["error"] = final_state["error"]
            # Always persist these even on error so the frontend can tell
            # whether the AI modification succeeded (compilation-only failure)
            jobs[job_id]["source_dir"] = final_state.get("source_dir")
            jobs[job_id]["modification_summary"] = final_state.get("modification_summary") or None
            await emit(f"❌ Error: {final_state['error']}")
            await queue.put({"event": "error", "data": final_state["error"]})
        else:
            jobs[job_id]["status"] = "done"
            jobs[job_id]["pdf_path"] = final_state.get("pdf_path")
            jobs[job_id]["source_dir"] = final_state.get("source_dir")
            jobs[job_id]["modification_summary"] = final_state.get("modification_summary", "")
            await emit("🎉 Resume tailoring complete! Your PDF is ready.")
            await queue.put({"event": "done", "data": job_id})

    except Exception as e:
        logger.exception("Agent run error for job %s", job_id)
        jobs[job_id]["status"] = "error"
        jobs[job_id]["error"] = str(e)
        await emit(f"❌ Unexpected error: {str(e)}")
        await queue.put({"event": "error", "data": str(e)})


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.post("/api/tailor")
async def tailor_resume(
    background_tasks: BackgroundTasks,
    jd_file: UploadFile = File(..., description="Job description file (PDF or TXT)"),
    latex_zip: UploadFile = File(..., description="Overleaf project ZIP file"),
    instructions: str = Form(..., description="User instructions for tailoring"),
):
    """
    Accept the JD, LaTeX ZIP, and instructions.
    Start the agent in the background and return a job_id for status polling.
    """
    job_id = str(uuid.uuid4())

    # Create a temporary working directory for this job
    work_dir = tempfile.mkdtemp(prefix=f"resume_tailor_{job_id[:8]}_")
    logger.info("Job %s: work_dir=%s", job_id, work_dir)

    # Save uploaded files to disk
    jd_path = Path(work_dir) / jd_file.filename
    zip_path = Path(work_dir) / latex_zip.filename

    async with aiofiles.open(jd_path, "wb") as f:
        content = await jd_file.read()
        await f.write(content)

    async with aiofiles.open(zip_path, "wb") as f:
        content = await latex_zip.read()
        await f.write(content)

    # Extract JD text
    jd_suffix = jd_file.filename.lower().rsplit(".", 1)[-1]
    if jd_suffix == "pdf":
        jd_text = extract_pdf_text(str(jd_path))
    else:
        async with aiofiles.open(jd_path, "r", encoding="utf-8", errors="replace") as f:
            jd_text = await f.read()

    if not jd_text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from JD file.")

    # Initialize job store entry
    jobs[job_id] = {
        "status": "running",
        "updates": [],
        "pdf_path": None,
        "source_dir": None,
        "work_dir": work_dir,
        "error": None,
        "modification_summary": None,
        "queue": asyncio.Queue(),
    }

    # Build initial agent state
    initial_state: AgentState = {
        "jd_text": jd_text,
        "zip_path": str(zip_path),
        "instructions": instructions,
        "work_dir": work_dir,
        "status_updates": [],
        "error": None,
        "pdf_path": None,
    }

    # Run agent in background
    background_tasks.add_task(run_agent, job_id, initial_state)

    return {"job_id": job_id, "message": "Resume tailoring started."}


@app.get("/api/status/{job_id}")
async def stream_status(job_id: str):
    """
    Server-Sent Events endpoint that streams real-time status updates for a job.
    """
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    async def event_generator() -> AsyncGenerator[dict, None]:
        job = jobs[job_id]
        queue: asyncio.Queue = job["queue"]

        # First, replay any updates already emitted
        for update in list(job["updates"]):
            yield {"event": "update", "data": update}

        # If already done/error, send final event
        if job["status"] == "done":
            yield {"event": "done", "data": job_id}
            return
        if job["status"] == "error":
            yield {"event": "error", "data": job.get("error", "Unknown error")}
            return

        # Stream new events from the queue
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
                yield event
                if event.get("event") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield {"event": "heartbeat", "data": "ping"}

    return EventSourceResponse(event_generator())


@app.get("/api/download/{job_id}")
async def download_pdf(job_id: str):
    """Return the compiled PDF for a completed job."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = jobs[job_id]
    if job["status"] != "done":
        raise HTTPException(status_code=400, detail="Job is not complete yet.")
    if not job["pdf_path"] or not Path(job["pdf_path"]).exists():
        raise HTTPException(status_code=404, detail="PDF not found. Compilation may have failed.")

    return FileResponse(
        path=job["pdf_path"],
        media_type="application/pdf",
        filename="tailored_resume.pdf",
    )


@app.get("/api/tex/{job_id}")
async def download_tex_zip(job_id: str):
    """Return a ZIP of the modified .tex source files (useful if compilation failed)."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    job = jobs[job_id]
    source_dir = job.get("source_dir")
    if not source_dir or not Path(source_dir).exists():
        raise HTTPException(status_code=404, detail="Source files not found.")

    work_dir = job["work_dir"]
    zip_out = Path(work_dir) / "modified_latex.zip"

    with zipfile.ZipFile(zip_out, "w", zipfile.ZIP_DEFLATED) as zf:
        source_path = Path(source_dir)
        for f in source_path.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(source_path))

    return FileResponse(
        path=str(zip_out),
        media_type="application/zip",
        filename="modified_latex_source.zip",
    )


@app.get("/api/job/{job_id}")
async def get_job_info(job_id: str):
    """Return metadata about a job (status, summary, error)."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = jobs[job_id]
    return {
        "job_id": job_id,
        "status": job["status"],
        "modification_summary": job.get("modification_summary"),
        "error": job.get("error"),
        "has_pdf": bool(job.get("pdf_path") and Path(job["pdf_path"]).exists()),
    }


@app.get("/api/latex/{job_id}")
async def get_main_latex(job_id: str):
    """Return the content of the main .tex file as plain text (used for Overleaf/clipboard)."""
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found.")

    source_dir = jobs[job_id].get("source_dir")
    if not source_dir or not Path(source_dir).exists():
        raise HTTPException(status_code=404, detail="Source files not found.")

    from agent.tools import find_main_tex
    main_tex = find_main_tex(source_dir)
    if not main_tex or not Path(main_tex).exists():
        raise HTTPException(status_code=404, detail="Main .tex file not found.")

    content = Path(main_tex).read_text(encoding="utf-8", errors="replace")
    from fastapi.responses import PlainTextResponse
    return PlainTextResponse(content=content, media_type="text/plain")


@app.get("/health")
async def health():
    return {"status": "ok"}
