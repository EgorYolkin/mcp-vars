import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { VariableService } from "../domain/service";
import { TOOL_DESCRIPTIONS, USAGE_INSTRUCTIONS } from "./instructions";

export function registerResources(server: McpServer): void {
  server.registerResource(
    "usage-instructions",
    new ResourceTemplate("instructions://usage", { list: undefined }),
    {
      title: "Usage Instructions",
      description: "Usage guidance for mcp-vars",
      mimeType: "text/plain",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          text: USAGE_INSTRUCTIONS,
        },
      ],
    }),
  );
}

export function registerTools(server: McpServer, service: VariableService): void {
  server.registerTool(
    "variable_get",
    {
      description: TOOL_DESCRIPTIONS.variable_get,
      inputSchema: z.object({
        key: z.string(),
        scope: z.enum(["project", "user"]).optional(),
      }),
    },
    async ({ key, scope }) => toolResult(await service.get(key, scope)),
  );

  server.registerTool(
    "variable_set",
    {
      description: TOOL_DESCRIPTIONS.variable_set,
      inputSchema: z.object({
        key: z.string(),
        value: z.any(),
        scope: z.enum(["project", "user"]).optional(),
      }),
    },
    async ({ key, value, scope }) => toolResult(await service.set(key, value, scope)),
  );

  server.registerTool(
    "variable_patch",
    {
      description: TOOL_DESCRIPTIONS.variable_patch,
      inputSchema: z.object({
        key: z.string(),
        patch: z.record(z.string(), z.any()),
        scope: z.enum(["project", "user"]).optional(),
      }),
    },
    async ({ key, patch, scope }) => toolResult(await service.patch(key, patch, scope)),
  );

  server.registerTool(
    "variable_delete",
    {
      description: TOOL_DESCRIPTIONS.variable_delete,
      inputSchema: z.object({
        key: z.string(),
        scope: z.enum(["project", "user"]).optional(),
      }),
    },
    async ({ key, scope }) => toolResult(await service.delete(key, scope)),
  );

  server.registerTool(
    "variable_list",
    {
      description: TOOL_DESCRIPTIONS.variable_list,
      inputSchema: z.object({
        prefix: z.string().optional(),
        scope: z.enum(["project", "user"]).optional(),
      }),
    },
    async ({ prefix, scope }) => toolResult(await service.list(scope, prefix ?? null)),
  );
}

function toolResult(result: Awaited<ReturnType<VariableService["get"]>>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: { ...result },
    isError: result.status === "error",
  };
}
