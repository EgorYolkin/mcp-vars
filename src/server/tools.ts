import { z } from "zod/v4";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { VariableService } from "../domain/service";
import { TOOL_DESCRIPTIONS, USAGE_INSTRUCTIONS } from "./instructions";

const scopeSchema = z.enum(["project", "user"]);
const metadataSchema = {
  namespace: z.string().optional(),
  owner: z.string().optional(),
  tags: z.array(z.string()).optional(),
};

const toolOutputSchema = z.object({
  status: z.enum(["ok", "not_found", "error"]),
  key: z.string().nullable(),
  value: z.any(),
  message: z.string(),
  scope: scopeSchema.optional(),
  warnings: z.array(z.string()).optional(),
});

const setItemSchema = z.object({
  key: z.string(),
  value: z.any(),
  scope: scopeSchema,
  expires_at: z.string().optional(),
  ...metadataSchema,
});

const deleteItemSchema = z.object({
  key: z.string(),
  scope: scopeSchema,
});

const snapshotSchema = z.object({
  project: z.record(z.string(), z.any()),
  user: z.record(z.string(), z.any()),
});

export function registerResources(server: McpServer, service: VariableService): void {
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

  for (const scope of ["project", "user"] as const) {
    server.registerResource(
      `vars-${scope}`,
      new ResourceTemplate(`vars://${scope}`, { list: undefined }),
      {
        title: `${scope} variables`,
        description: `Read-only snapshot of ${scope} scope variables`,
        mimeType: "application/json",
      },
      async (uri) => {
        const result = await service.listFiltered(scope);
        return resourceJson(uri.href, result.value);
      },
    );

    server.registerResource(
      `vars-${scope}-prefix`,
      new ResourceTemplate(`vars://${scope}/{prefix}`, { list: undefined }),
      {
        title: `${scope} variables by prefix`,
        description: `Read-only filtered snapshot of ${scope} scope variables`,
        mimeType: "application/json",
      },
      async (uri, variables) => {
        const prefix = Array.isArray(variables.prefix) ? variables.prefix[0] : variables.prefix;
        const result = await service.listFiltered(scope, { prefix });
        return resourceJson(uri.href, result.value);
      },
    );
  }
}

export function registerTools(server: McpServer, service: VariableService): void {
  server.registerTool(
    "variable_get",
    {
      description: TOOL_DESCRIPTIONS.variable_get,
      inputSchema: z.object({
        key: z.string(),
        scope: scopeSchema.optional(),
      }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true },
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
        scope: scopeSchema.optional(),
        expires_at: z.string().optional(),
        ...metadataSchema,
      }),
      outputSchema: toolOutputSchema,
    },
    async ({ key, value, scope, expires_at, namespace, owner, tags }) =>
      toolResult(await service.set(key, value, scope, expires_at, { namespace, owner, tags })),
  );

  server.registerTool(
    "variable_patch",
    {
      description: TOOL_DESCRIPTIONS.variable_patch,
      inputSchema: z.object({
        key: z.string(),
        patch: z.record(z.string(), z.any()),
        scope: scopeSchema.optional(),
      }),
      outputSchema: toolOutputSchema,
    },
    async ({ key, patch, scope }) => toolResult(await service.patch(key, patch, scope)),
  );

  server.registerTool(
    "variable_delete",
    {
      description: TOOL_DESCRIPTIONS.variable_delete,
      inputSchema: z.object({
        key: z.string(),
        scope: scopeSchema.optional(),
      }),
      outputSchema: toolOutputSchema,
      annotations: { destructiveHint: true },
    },
    async ({ key, scope }) => toolResult(await service.delete(key, scope)),
  );

  server.registerTool(
    "variable_list",
    {
      description: TOOL_DESCRIPTIONS.variable_list,
      inputSchema: z.object({
        prefix: z.string().optional(),
        scope: scopeSchema.optional(),
        namespace: z.string().optional(),
        owner: z.string().optional(),
        tag: z.string().optional(),
      }),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async ({ prefix, scope, namespace, owner, tag }) =>
      toolResult(await service.listFiltered(scope, { prefix, namespace, owner, tag })),
  );

  server.registerTool(
    "variable_bulk_set",
    {
      description: TOOL_DESCRIPTIONS.variable_bulk_set,
      inputSchema: z.object({ items: z.array(setItemSchema).min(1) }),
      outputSchema: toolOutputSchema,
    },
    async ({ items }) =>
      toolResult(
        await service.bulkSet(
          items.map((item) => ({
            key: item.key,
            value: item.value,
            scope: item.scope,
            expiresAt: item.expires_at,
            namespace: item.namespace,
            owner: item.owner,
            tags: item.tags,
          })),
        ),
      ),
  );

  server.registerTool(
    "variable_bulk_delete",
    {
      description: TOOL_DESCRIPTIONS.variable_bulk_delete,
      inputSchema: z.object({ items: z.array(deleteItemSchema).min(1) }),
      outputSchema: toolOutputSchema,
      annotations: { destructiveHint: true },
    },
    async ({ items }) => toolResult(await service.bulkDelete(items)),
  );

  server.registerTool(
    "variable_export",
    {
      description: TOOL_DESCRIPTIONS.variable_export,
      inputSchema: z.object({}),
      outputSchema: toolOutputSchema,
      annotations: { readOnlyHint: true },
    },
    async () => toolResult(await service.exportSnapshot()),
  );

  server.registerTool(
    "variable_import",
    {
      description: TOOL_DESCRIPTIONS.variable_import,
      inputSchema: z.object({ snapshot: snapshotSchema }),
      outputSchema: toolOutputSchema,
      annotations: { destructiveHint: true },
    },
    async ({ snapshot }) => toolResult(await service.importSnapshot(snapshot)),
  );

  server.registerTool(
    "variable_cleanup_expired",
    {
      description: TOOL_DESCRIPTIONS.variable_cleanup_expired,
      inputSchema: z.object({ scope: scopeSchema.optional() }),
      outputSchema: toolOutputSchema,
      annotations: { destructiveHint: true },
    },
    async ({ scope }) => toolResult(await service.cleanupExpired(scope)),
  );

  server.registerTool(
    "variable_set_if_version",
    {
      description: TOOL_DESCRIPTIONS.variable_set_if_version,
      inputSchema: z.object({
        key: z.string(),
        value: z.any(),
        scope: scopeSchema.optional(),
        expected_revision: z.number().int().nonnegative().optional(),
        expected_updated_at: z.string().optional(),
        expires_at: z.string().optional(),
        ...metadataSchema,
      }),
      outputSchema: toolOutputSchema,
    },
    async ({
      key,
      value,
      scope,
      expected_revision,
      expected_updated_at,
      expires_at,
      namespace,
      owner,
      tags,
    }) =>
      toolResult(
        await service.setIfVersion(
          key,
          value,
          scope,
          expected_revision,
          expected_updated_at,
          expires_at,
          { namespace, owner, tags },
        ),
      ),
  );

  server.registerTool(
    "variable_patch_if_version",
    {
      description: TOOL_DESCRIPTIONS.variable_patch_if_version,
      inputSchema: z.object({
        key: z.string(),
        patch: z.record(z.string(), z.any()),
        scope: scopeSchema.optional(),
        expected_revision: z.number().int().nonnegative().optional(),
        expected_updated_at: z.string().optional(),
      }),
      outputSchema: toolOutputSchema,
    },
    async ({ key, patch, scope, expected_revision, expected_updated_at }) =>
      toolResult(await service.patchIfVersion(key, patch, scope, expected_revision, expected_updated_at)),
  );

  server.registerTool(
    "variable_increment",
    {
      description: TOOL_DESCRIPTIONS.variable_increment,
      inputSchema: z.object({
        key: z.string(),
        delta: z.number().optional(),
        scope: scopeSchema.optional(),
      }),
      outputSchema: toolOutputSchema,
    },
    async ({ key, delta, scope }) => toolResult(await service.increment(key, delta, scope)),
  );

  server.registerTool(
    "variable_append",
    {
      description: TOOL_DESCRIPTIONS.variable_append,
      inputSchema: z.object({
        key: z.string(),
        item: z.any(),
        scope: scopeSchema.optional(),
      }),
      outputSchema: toolOutputSchema,
    },
    async ({ key, item, scope }) => toolResult(await service.append(key, item, scope)),
  );

  server.registerTool(
    "variable_remove_from_array",
    {
      description: TOOL_DESCRIPTIONS.variable_remove_from_array,
      inputSchema: z.object({
        key: z.string(),
        item: z.any(),
        scope: scopeSchema.optional(),
      }),
      outputSchema: toolOutputSchema,
    },
    async ({ key, item, scope }) => toolResult(await service.removeFromArray(key, item, scope)),
  );
}

function toolResult(result: Awaited<ReturnType<VariableService["get"]>>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(result) }],
    structuredContent: { ...result },
    isError: result.status === "error",
  };
}

function resourceJson(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}
