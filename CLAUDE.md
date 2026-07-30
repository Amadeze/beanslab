@AGENTS.md

## graphify-ts

IMPORTANT: This project has a graphify-ts knowledge graph. You MUST follow these rules:

1. **BEFORE answering ANY codebase question**, start with the graph tool that matches the question:
   - `retrieve` for "how does X work?" and other direct codebase questions
   - `relevant_files` for "which files should I open first?"
   - `feature_map` for "what parts of the codebase are involved?"
   - `risk_map` before editing to see likely hotspots
   - `implementation_checklist` for edit order and validation checkpoints
   - `impact` for "what breaks if I change X?"
2. **Do NOT use Glob, Grep, Bash, Read, or dispatch Agent/Explore subagents first** for codebase questions.
3. **Only fall back to raw file tools** if the graph tools cannot answer the question or the MCP server is unavailable. In that case, read graphify-out/GRAPH_REPORT.md first.
4. **Do NOT dispatch Explore or research agents** for codebase questions — the knowledge graph already has the structural context they would spend tokens discovering.
