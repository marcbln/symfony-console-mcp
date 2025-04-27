#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Create an MCP server with capabilities for tools.
 */
const server = new Server(
  {
    name: "docker-console-server",
    version: "0.1.0",
    description: "Execute bin/console commands inside a docker container specified by CONTAINER_NAME",
  },
  {
    capabilities: {
      tools: {},
      // Removed resources and prompts capabilities from the template
    },
  }
);

/**
 * Handler that lists available tools.
 * Exposes a single "execute_console_command" tool.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "execute_console_command",
        description: "Execute a bin/console command inside the docker container specified by CONTAINER_NAME",
        inputSchema: {
          type: "object",
          properties: {
            command: {
              type: "string",
              description: "The bin/console command arguments to execute (e.g., 'cache:clear')"
            }
          },
          required: ["command"]
        }
      }
    ]
  };
});

// Type guard to check if arguments are valid for our tool
const isValidExecArgs = (args: any): args is { command: string } =>
  typeof args === 'object' && args !== null && typeof args.command === 'string';


/**
 * Handler for the execute_console_command tool.
 * Executes the provided command inside the docker container specified by CONTAINER_NAME using 'docker exec'.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "execute_console_command") {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  if (!isValidExecArgs(request.params.arguments)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments: "command" (string) is required.');
  }

  const consoleCommand = request.params.arguments.command;
  // Basic sanitization to prevent command injection vulnerabilities like '; rm -rf /'
  // This is a simple example; more robust sanitization might be needed depending on usage.
  if (/[;&|`$()]/.test(consoleCommand)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid characters detected in command.');
  }

  if (!process.env.CONTAINER_NAME) {
    throw new Error('CONTAINER_NAME environment variable is required');
  }
  const fullDockerCommand = `docker exec ${process.env.CONTAINER_NAME} bin/console ${consoleCommand}`;

  try {
    console.error(`Executing: ${fullDockerCommand}`); // Log the command being executed to server stderr
    const { stdout, stderr } = await execAsync(fullDockerCommand);

    // Combine stdout and stderr for the result.
    // If stderr has content, it might indicate warnings or non-fatal errors from the console command.
    const output = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;

    return {
      content: [{
        type: "text",
        text: output
      }],
      // Indicate error if stderr is not empty, even if exec didn't throw an error code.
      // Some console commands might report issues via stderr without exiting non-zero.
      isError: !!stderr 
    };
  } catch (error: any) {
    console.error(`Error executing command: ${error}`); // Log the error to server stderr
    // If exec fails (e.g., container not running, command not found), return an error response.
    return {
      content: [{
        type: "text",
        // Include error message, stdout, and stderr if available
        text: `Execution failed: ${error.message}\n\nSTDOUT:\n${error.stdout || ''}\n\nSTDERR:\n${error.stderr || ''}`
      }],
      isError: true
    };
  }
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  server.onerror = (error) => console.error('[MCP Error]', error); // Add basic error logging
  process.on('SIGINT', async () => {
      console.error('Received SIGINT, shutting down server...');
      await server.close();
      process.exit(0);
  });
  await server.connect(transport);
  console.error('Docker Console MCP server running on stdio'); // Log startup to stderr
}

main().catch((error) => {
  console.error("Server failed to start:", error);
  process.exit(1);
});
