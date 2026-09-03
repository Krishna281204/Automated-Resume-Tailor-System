"""
state.py — TypedDict definition for the LangGraph agent state.
"""

from typing import TypedDict, Optional


class AgentState(TypedDict, total=False):
    # Inputs
    jd_text: str                        # Job description text (extracted from uploaded file)
    zip_path: str                       # Path to the uploaded ZIP on disk
    instructions: str                   # User's free-text instructions
    work_dir: str                       # Temporary working directory for this job

    # Intermediate
    source_dir: str                     # Directory containing extracted .tex files
    latex_files: dict[str, str]         # {relative_path: content} of all .tex files
    main_tex: str                       # Absolute path to the main .tex file

    # Outputs
    modified_latex: dict[str, str]      # Final modified .tex files (same structure)
    modification_summary: str           # Human-readable summary of changes made
    pdf_path: Optional[str]             # Absolute path to compiled PDF (None on failure)
    compile_log: str                    # Full pdflatex log output

    # Status / Error tracking
    status_updates: list[str]           # List of status messages (streamed to frontend)
    error: Optional[str]                # Error message if something failed
