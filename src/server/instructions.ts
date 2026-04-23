export const SERVER_INSTRUCTIONS =
  "Persistent variable store for MCP agents. Use project scope for repository-specific state and user scope for shared user state. Use when you need to remember values, counters, task state, or any structured data between steps.";

export const USAGE_INSTRUCTIONS = `
Use mcp-vars when you need to:
- Track values across multiple steps (counters, state, progress)
- Remember data between tool calls in a session
- Share state between parallel agents
- Avoid rewriting memory files

Do NOT use for: large blobs (>10KB), binary data, or one-shot computations.

Key format: dot-notation, e.g. "task.step" or "session.counter"
Default namespace: "shared" (visible to all clients)
`.trim();

export const TOOL_DESCRIPTIONS = {
  variable_get:
    "Load one variable. Use variable_list to discover keys when you do not know the exact key.",
  variable_set:
    "Create or overwrite a variable. Use variable_patch to update object fields without replacing the value.",
  variable_patch:
    "Shallow-merge fields into an existing object value. Use variable_set when you want full replacement.",
  variable_delete:
    "Delete one variable by exact key. Use variable_bulk_delete only when removing several keys at once.",
  variable_list:
    "List keys in one scope. Use variable_get for a known key; list is for discovery and prefix filtering.",
} as const;
