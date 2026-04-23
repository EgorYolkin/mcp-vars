import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { VariableValidationError } from "../domain/errors";
import { ScopedStores, VariableService } from "../domain/service";
import { LazyVariableStore } from "../storage/lazy-store";
import {
  resolveProjectDbPath,
  resolveUserDbPath,
} from "../storage/path-resolver";
import { JsonVariableStore } from "../storage/json-store";
import { SERVER_INSTRUCTIONS } from "./instructions";
import { registerResources, registerTools } from "./tools";

export function createMcp(env: NodeJS.ProcessEnv = process.env): McpServer {
  const server = new McpServer(
    {
      name: "mcp-vars",
      version: "0.1.0",
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );

  const service = new VariableService(buildScopedStores(env));
  registerTools(server, service);
  registerResources(server);
  return server;
}

function buildScopedStores(env: NodeJS.ProcessEnv): ScopedStores {
  const userStore = new LazyVariableStore(
    () => new JsonVariableStore(resolveUserDbPath(env)),
  );
  const projectStore = buildProjectStore(env);
  return { user: userStore, project: projectStore };
}

function buildProjectStore(env: NodeJS.ProcessEnv): LazyVariableStore | null {
  try {
    const projectPath = resolveProjectDbPath(env);
    return new LazyVariableStore(() => new JsonVariableStore(projectPath));
  } catch (error) {
    if (error instanceof VariableValidationError) {
      return null;
    }
    throw error;
  }
}
