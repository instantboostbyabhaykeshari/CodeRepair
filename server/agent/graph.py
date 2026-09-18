from langgraph.graph import END, START, StateGraph

from agent import nodes
from agent.state import AgentState


def after_context(state):
    return "plan_solution" if state["enough_context"] else "read_files"


def build_graph():
    builder = StateGraph(AgentState)
    sequence = ["fetch_issue", "clone_repository", "inspect_repository", "select_relevant_files",
                "read_files", "check_context", "plan_solution", "generate_patch",
                "apply_patch", "validate_changes", "prepare_result"]
    for name in sequence:
        builder.add_node(name, getattr(nodes, name))
    builder.add_edge(START, sequence[0])
    for current, following in zip(sequence, sequence[1:]):
        if current != "check_context":
            builder.add_edge(current, following)
    # Gemini's context decision controls this bounded loop.
    builder.add_conditional_edges("check_context", after_context,
                                  {"read_files": "read_files", "plan_solution": "plan_solution"})
    builder.add_edge("prepare_result", END)
    # The analysis graph ends here. FastAPI holds the result for human approval.
    return builder.compile()
