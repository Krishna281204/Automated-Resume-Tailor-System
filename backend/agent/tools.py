"""
tools.py — Helper utilities for the LaTeX Resume Tailor agent.
Handles ZIP extraction, pdflatex compilation, and PDF text extraction.
"""

import os
import zipfile
import subprocess
import shutil
import tempfile
import logging
from pathlib import Path
from typing import Optional

import PyPDF2

logger = logging.getLogger(__name__)


def extract_zip(zip_path: str, extract_dir: str) -> str:
    """
    Extract a ZIP file (e.g., Overleaf project export) into extract_dir.
    Returns the path to the directory containing the main .tex file.
    """
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(extract_dir)

    # Overleaf ZIPs sometimes have a single top-level folder; flatten if so.
    entries = list(Path(extract_dir).iterdir())
    if len(entries) == 1 and entries[0].is_dir():
        return str(entries[0])
    return extract_dir


def find_main_tex(source_dir: str) -> Optional[str]:
    """
    Heuristically locate the main .tex file in a source directory.
    Priority: file named 'main.tex', then 'resume.tex', then 'cv.tex',
    then the largest .tex file.
    """
    source = Path(source_dir)
    priority_names = ["main.tex", "resume.tex", "cv.tex", "template.tex"]

    for name in priority_names:
        candidate = source / name
        if candidate.exists():
            return str(candidate)

    # Fall back to the largest .tex file
    tex_files = list(source.rglob("*.tex"))
    if not tex_files:
        return None
    return str(max(tex_files, key=lambda p: p.stat().st_size))


def read_latex_source(source_dir: str) -> dict[str, str]:
    """
    Read all .tex and .bib files in a directory into a dict {relative_path: content}.
    """
    source = Path(source_dir)
    result: dict[str, str] = {}
    for ext in ("*.tex", "*.bib", "*.cls", "*.sty"):
        for f in source.rglob(ext):
            try:
                relative = str(f.relative_to(source))
                result[relative] = f.read_text(encoding="utf-8", errors="replace")
            except Exception as e:
                logger.warning(f"Could not read {f}: {e}")
    return result


def write_latex_source(source_dir: str, files: dict[str, str]) -> None:
    """
    Write modified .tex file contents back to disk.
    files: dict of {relative_path: new_content}
    """
    source = Path(source_dir)
    for relative_path, content in files.items():
        target = source / relative_path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")


def run_pdflatex(source_dir: str, main_tex: str, output_dir: str) -> tuple[bool, str]:
    """
    Compile a LaTeX file using pdflatex.
    Runs twice to resolve cross-references.
    Returns (success: bool, log_output: str).
    """
    main_tex_path = Path(main_tex)
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    cmd = [
        "pdflatex",
        "-interaction=nonstopmode",
        "-halt-on-error",
        f"-output-directory={output_dir}",
        str(main_tex_path),
    ]

    combined_log = ""
    success = False

    # Run twice (first pass may fail due to aux files not yet existing)
    for run_number in range(1, 3):
        try:
            result = subprocess.run(
                cmd,
                cwd=source_dir,
                capture_output=True,
                text=True,
                timeout=120,
            )
            combined_log += f"\n--- pdflatex run {run_number} ---\n"
            combined_log += result.stdout
            if result.stderr:
                combined_log += "\nSTDERR:\n" + result.stderr

            # pdflatex returns 0 on success
            if result.returncode == 0:
                success = True
            else:
                # On first run, continue to second pass anyway
                if run_number == 2:
                    success = False
        except subprocess.TimeoutExpired:
            combined_log += f"\n--- pdflatex run {run_number} timed out ---\n"
            success = False
            break
        except FileNotFoundError:
            combined_log += "\nERROR: pdflatex not found. Please install TeX Live or MiKTeX.\n"
            success = False
            break

    return success, combined_log


def extract_pdf_text(pdf_path: str) -> str:
    """
    Extract text from a PDF file (used for reading JD uploaded as PDF).
    """
    text_parts = []
    try:
        with open(pdf_path, "rb") as f:
            reader = PyPDF2.PdfReader(f)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text_parts.append(extracted)
    except Exception as e:
        logger.error(f"PDF extraction error: {e}")
        return ""
    return "\n".join(text_parts)
