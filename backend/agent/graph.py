"""
graph.py — LangGraph StateGraph definition for the LaTeX Resume Tailor agent.

Workflow:
  START
    └→ extract_latex
         ├→ (error) → END
         └→ analyze_and_modify
              ├→ (error) → END
              └→ compile_latex
                   ├→ (error) → END
                   └→ END (success)
"""

from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.nodes import (
    node_extract_latex,
    node_analyze_and_modify,
    node_compile_latex,
    route_after_extract,
    route_after_modify,
    route_after_compile,
)


def build_graph() -> StateGraph:
    """Constructs and compiles the LangGraph agent workflow."""

    builder = StateGraph(AgentState)

    # Register nodes
    builder.add_node("extract_latex", node_extract_latex)
    builder.add_node("analyze_and_modify", node_analyze_and_modify)
    builder.add_node("compile_latex", node_compile_latex)

    # Entry point
    builder.set_entry_point("extract_latex")

    # Conditional edges
    builder.add_conditional_edges(
        "extract_latex",
        route_after_extract,
        {
            "analyze_and_modify": "analyze_and_modify",
            "end_with_error": END,
        },
    )

    builder.add_conditional_edges(
        "analyze_and_modify",
        route_after_modify,
        {
            "compile_latex": "compile_latex",
            "end_with_error": END,
        },
    )

    builder.add_conditional_edges(
        "compile_latex",
        route_after_compile,
        {
            "end_success": END,
            "end_with_error": END,
        },
    )

    return builder.compile()


# Singleton compiled graph
tailor_graph = build_graph()
