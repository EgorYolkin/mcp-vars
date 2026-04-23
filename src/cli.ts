#!/usr/bin/env node

import { config as loadEnv } from "dotenv";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import {
  DEFAULT_SERVER_NAME,
  SUPPORTED_CLIENTS,
  formatInstallReport,
  installConfigs,
} from "./install/installer";
import { createMcp } from "./server/app";

interface ParsedArgs {
  command: "install" | "run";
  clients: string[];
  serverName: string;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  loadEnv();
  const args = parseArgs(argv);

  if (args.command === "install") {
    const results = installConfigs({
      clients: args.clients,
      serverName: args.serverName,
    });
    process.stdout.write(`${formatInstallReport(results)}\n`);
    return 0;
  }

  const server = createMcp();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  return 0;
}

function parseArgs(argv: string[]): ParsedArgs {
  if (argv[0] !== "install") {
    return {
      command: "run",
      clients: [...SUPPORTED_CLIENTS],
      serverName: DEFAULT_SERVER_NAME,
    };
  }

  let clients = [...SUPPORTED_CLIENTS];
  let serverName = DEFAULT_SERVER_NAME;

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--clients") {
      clients = [];
      for (index += 1; index < argv.length && !argv[index].startsWith("--"); index += 1) {
        clients.push(argv[index]);
      }
      index -= 1;
      continue;
    }
    if (token === "--server-name") {
      serverName = argv[index + 1] ?? DEFAULT_SERVER_NAME;
      index += 1;
    }
  }

  return {
    command: "install",
    clients,
    serverName,
  };
}

void main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  },
);
