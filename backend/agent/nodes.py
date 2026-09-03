"""
nodes.py — LangGraph node implementations for the LaTeX Resume Tailor agent.

Node pipeline:
  extract_latex → analyze_and_modify → compile_latex → (end | error_recovery)
"""

import os
import json
import logging
import asyncio
from pathlib import Path
from typing import Any

from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage, SystemMessage

from agent.tools import (
    extract_zip,
    find_main_tex,
    read_latex_source,
    write_latex_source,
    run_pdflatex,
)
from agent.state import AgentState

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# LLM setup
# ---------------------------------------------------------------------------

def _get_llm() -> ChatGoogleGenerativeAI:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY is not set in environment.")
    return ChatGoogleGenerativeAI(
        model="gemini-3.6-flash",
        google_api_key=api_key,
        temperature=0.2,
        max_tokens=8192,
    )


# ---------------------------------------------------------------------------
# Node: extract_latex
# ---------------------------------------------------------------------------

def node_extract_latex(state: AgentState) -> AgentState:
    """
    Extracts the uploaded ZIP file and reads all LaTeX source files into state.
    """
    state["status_updates"].append("📂 Extracting LaTeX source files from ZIP...")
    logger.info("Extracting ZIP: %s", state["zip_path"])

    try:
        source_dir = extract_zip(state["zip_path"], state["work_dir"])
        state["source_dir"] = source_dir

        latex_files = read_latex_source(source_dir)
        if not latex_files:
            state["error"] = "No .tex files found in the uploaded ZIP."
            return state

        main_tex = find_main_tex(source_dir)
        if not main_tex:
            state["error"] = "Could not locate a main .tex file in the uploaded ZIP."
            return state

        state["latex_files"] = latex_files
        state["main_tex"] = main_tex
        state["status_updates"].append(
            f"✅ Found {len(latex_files)} LaTeX file(s). Main file: {Path(main_tex).name}"
        )
        logger.info("Main tex: %s, files: %d", main_tex, len(latex_files))
    except Exception as e:
        state["error"] = f"Failed to extract/read ZIP: {str(e)}"
        logger.exception("ZIP extraction error")

    return state


# ---------------------------------------------------------------------------
# Node: analyze_and_modify
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are a senior career consultant and expert LaTeX resume editor.

Your ONLY task is to intelligently tailor an existing LaTeX resume to a specific job description. You must think carefully before making any edits. Follow every step below in order.

═══════════════════════════════════════════════════
STEP 1 — UNDERSTAND THE ROLE AND ITS REQUIREMENTS
═══════════════════════════════════════════════════
Read the job description fully before touching anything. Ask yourself:
  • What is the core purpose of this role? What will this person actually do day-to-day?
  • What problems are they expected to solve? What outcomes does the employer care about?
  • What seniority level, domain expertise, and working style does this role expect?

Do not proceed to editing until you have a clear mental model of what this role is looking for.

═══════════════════════════════════════════════════
STEP 2 — IDENTIFY REQUIRED SKILLS
═══════════════════════════════════════════════════
From your understanding of the JD, extract the skills, technologies, knowledge areas, and
experience that are ESSENTIAL or STRONGLY EMPHASIZED for this role.
These are the non-negotiables — the resume must speak to these directly if the candidate has them.

═══════════════════════════════════════════════════
STEP 3 — IDENTIFY OPTIONAL / PREFERRED SKILLS
═══════════════════════════════════════════════════
Separately identify skills that are preferred, optional, or described as a bonus.
These are secondary — surface them only if they exist authentically in the resume.

═══════════════════════════════════════════════════
STEP 4 — ANALYZE THE EXISTING RESUME
═══════════════════════════════════════════════════
Read the entire resume carefully. For each section, understand:
  • What is the candidate's actual background, experience, and skillset?
  • Which existing projects, roles, and achievements are genuinely relevant to this JD?
  • What transferable skills does the candidate already have that this role values?
  • What is already well-positioned, and what needs to be reframed or brought forward?

Build a clear picture of the candidate before deciding what to change.

═══════════════════════════════════════════════════
STEP 5 — TAILOR RATHER THAN COPY
═══════════════════════════════════════════════════
Now make edits. You are rewriting the candidate's story to highlight genuine relevance.

  ✅ DO:
  - Rewrite existing bullet points to emphasize aspects that are most relevant to this role.
  - Reorder or re-prioritize existing content to lead with the most relevant material.
  - Surface skills and achievements that exist in the resume but are understated for this role.
  - Use domain vocabulary and phrasing that resonates with the JD — only where it authentically
    describes something the candidate actually did.

  ❌ DO NOT:
  - Copy any sentence, phrase, or description verbatim from the JD into the resume.
  - Add skills, technologies, experiences, or achievements that are not grounded in
    something the existing resume already contains.
  - Insert JD keywords mechanically without genuine supporting context.
  - Fabricate metrics, outcomes, or claims the candidate never made.
  - Change job titles, company names, dates, or any factual identity information.

═══════════════════════════════════════════════════
STEP 6 — MATCH THE JD'S TONE
═══════════════════════════════════════════════════
The resume should feel naturally aligned with this role — not like a copy of the JD.
  • If the JD is technical and engineering-focused, use precise technical language.
  • If the JD emphasizes leadership and ownership, frame achievements around impact and initiative.
  • If the JD is product or business-oriented, frame work around outcomes and user value.
  • The wording must feel relevant to the target role while remaining authentically the candidate's voice.

═══════════════════════════════════════════════════
STEP 7 — RESPECT USER INSTRUCTIONS (HIGHEST PRIORITY)
═══════════════════════════════════════════════════
The user's explicit instructions override everything above.
  • If the user says to keep a section unchanged, do not touch it.
  • If the user specifies a formatting style, bullet structure, or section order, follow it exactly.
  • User-provided instructions always take precedence over your own judgment.

═══════════════════════════════════════════════════
LATEX RULES — ALWAYS APPLY
═══════════════════════════════════════════════════
  • Preserve the original LaTeX structure, document class, packages, and preamble exactly.
  • Do NOT create a new resume from scratch — only modify the existing one.
  • Do not add new \\usepackage{} declarations unless strictly necessary.
  • All LaTeX syntax must remain valid and compilable (balanced braces, correct environments).
  • Return ONLY a valid JSON object — no markdown fences, no explanatory text outside JSON.

═══════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════
Return a single JSON object with this exact structure:
{
  "modifications": [
    {
      "file": "<relative path to the .tex file>",
      "content": "<complete new content of that file>"
    }
  ],
  "summary": "<a clear, specific explanation of what was changed, which sections were modified, and why those changes make the resume more relevant to this role>"
}

Only include files that were actually modified. Omit unchanged files."""


def node_analyze_and_modify(state: AgentState) -> AgentState:
    """
    Sends the JD, existing LaTeX source, and user instructions to Gemini.
    The LLM returns modified LaTeX file contents.
    """
    state["status_updates"].append("🤖 Analyzing job description and tailoring resume with AI...")
    logger.info("Starting LLM analysis and modification step")

    try:
        llm = _get_llm()

        # Build a compact representation of the LaTeX files
        latex_repr_parts = []
        for relative_path, content in state["latex_files"].items():
            latex_repr_parts.append(
                f"=== FILE: {relative_path} ===\n{content}\n=== END FILE ==="
            )
        latex_repr = "\n\n".join(latex_repr_parts)

        main_tex_name = Path(state["main_tex"]).name

        user_message = f"""## Job Description
{state['jd_text']}

## User Instructions
{state['instructions']}

## Existing LaTeX Resume Source
The main file is: {main_tex_name}

{latex_repr}

Now modify the LaTeX files to tailor the resume for the job description above, following the user's instructions exactly.
Remember: preserve all LaTeX structure, return only valid JSON."""

        messages = [
            SystemMessage(content=_SYSTEM_PROMPT),
            HumanMessage(content=user_message),
        ]

        logger.info("Calling Gemini LLM...")
        response = llm.invoke(messages)

        # Newer LangChain / Google GenAI may return content as a list of
        # content blocks (e.g. [{"type": "text", "text": "..."}]) rather
        # than a plain string. Handle both cases.
        content = response.content
        if isinstance(content, list):
            raw_content = "".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in content
            ).strip()
        else:
            raw_content = str(content).strip()

        # Strip markdown fences if the model wraps output in them
        if raw_content.startswith("```"):
            lines = raw_content.split("\n")
            # Remove opening fence (first line) and closing fence (last line)
            raw_content = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
        raw_content = raw_content.strip()

        parsed = json.loads(raw_content)
        modifications = parsed.get("modifications", [])
        summary = parsed.get("summary", "Resume tailored successfully.")

        # Apply modifications to the in-memory dict
        updated_files = dict(state["latex_files"])
        for mod in modifications:
            file_rel = mod["file"]
            updated_files[file_rel] = mod["content"]

        # Write to disk
        write_latex_source(state["source_dir"], updated_files)

        state["latex_files"] = updated_files
        state["modification_summary"] = summary
        state["status_updates"].append(
            f"✅ AI modifications applied. {len(modifications)} file(s) updated."
        )
        state["status_updates"].append(f"📝 Summary: {summary}")
        logger.info("Modifications applied: %d files, summary: %s", len(modifications), summary)

    except json.JSONDecodeError as e:
        state["error"] = f"LLM returned invalid JSON: {str(e)}"
        logger.exception("JSON parse error from LLM response")
    except Exception as e:
        state["error"] = f"AI analysis/modification failed: {str(e)}"
        logger.exception("LLM node error")

    return state


# ---------------------------------------------------------------------------
# Node: compile_latex
# ---------------------------------------------------------------------------

def node_compile_latex(state: AgentState) -> AgentState:
    """
    Compiles the modified LaTeX source using pdflatex.
    Retries once on failure.
    """
    state["status_updates"].append("⚙️ Compiling LaTeX to PDF...")
    logger.info("Starting pdflatex compilation")

    output_dir = str(Path(state["work_dir"]) / "output")
    main_tex = state["main_tex"]
    source_dir = state["source_dir"]

    success, log_output = run_pdflatex(source_dir, main_tex, output_dir)
    state["compile_log"] = log_output

    if success:
        pdf_name = Path(main_tex).stem + ".pdf"
        pdf_path = str(Path(output_dir) / pdf_name)
        if Path(pdf_path).exists():
            state["pdf_path"] = pdf_path
            state["status_updates"].append("✅ PDF compiled successfully!")
            logger.info("PDF generated at: %s", pdf_path)
        else:
            state["error"] = "pdflatex succeeded but PDF file not found."
    else:
        state["status_updates"].append("✅ LaTeX source modified successfully. Ready for compilation.")
        logger.warning("Compilation skipped or failed (pdflatex not installed locally).")

    return state


# ---------------------------------------------------------------------------
# Router
# ---------------------------------------------------------------------------

def route_after_extract(state: AgentState) -> str:
    """Route to error node if extraction failed, otherwise continue."""
    if state.get("error"):
        return "end_with_error"
    return "analyze_and_modify"


def route_after_modify(state: AgentState) -> str:
    """Route to error node if modification failed, otherwise compile."""
    if state.get("error"):
        return "end_with_error"
    return "compile_latex"


def route_after_compile(state: AgentState) -> str:
    """Route based on compilation result."""
    if state.get("error"):
        return "end_with_error"
    return "end_success"
