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
 * Executes a console command inside the docker container specified by CONTAINER_NAME.
 * Encapsulates the logic for building and executing the docker exec command.
 * @param commandArgs The arguments to pass to the console command (e.g., "list --format=json").
 * @returns The result in the standard MCP tool response structure.
 */
const executeDockerConsoleCommand = async (commandArgs: string) => {
  // Basic sanitization to prevent command injection vulnerabilities like '; rm -rf /'
  // This is a simple example; more robust sanitization might be needed depending on usage.
  // Adapted from lines 79-81 in the original CallToolRequestSchema handler.
  if (/[;&|`$()]/.test(commandArgs)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid characters detected in command arguments.');
  }

  if (!process.env.CONTAINER_NAME) {
    throw new Error('CONTAINER_NAME environment variable is required');
  }
  const fullDockerCommand = `docker exec ${process.env.CONTAINER_NAME} ${process.env.PATH_CONSOLE || '/www/bin/console'} ${commandArgs}`;

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
};

/**
 * Create an MCP server with capabilities for tools.
 */
const server = new Server(
  {
    name: "docker-console-server",
    version: "0.1.0",
    description: "Execute console commands inside a docker container specified by CONTAINER_NAME with PATH_CONSOLE for executable path",
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
        description: `Execute a command using console script (${process.env.PATH_CONSOLE || '/www/bin/console'}) inside docker container "${process.env.CONTAINER_NAME || 'error-missing-env-CONTAINER_NAME'}"`,
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
      },
      {
        name: "list_commands",
        description: "Lists available console commands using `bin/console list --format=json`.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "command_help",
        description: "Gets help for a specific console command using `bin/console {commandName} --help`.",
        inputSchema: {
          type: "object",
          properties: {
            commandName: {
              type: "string",
              description: "The name of the command to get help for."
            }
          },
          required: ["commandName"]
        }
      }
    ]
  };
});

// Type guard to check if arguments are valid for our tool
const isValidExecArgs = (args: any): args is { command: string } =>
  typeof args === 'object' && args !== null && typeof args.command === 'string';
// Type guard to check if arguments are valid for command_help tool
const isValidHelpArgs = (args: any): args is { commandName: string } =>
  typeof args === 'object' && args !== null && typeof args.commandName === 'string';


/**
 * Handler for the execute_console_command tool.
 * Executes the provided command inside the docker container specified by CONTAINER_NAME using 'docker exec'.
 */

/**
 * Handler for tool calls.
 * Executes the requested tool based on its name.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "execute_console_command":
      if (!isValidExecArgs(request.params.arguments)) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for execute_console_command: "command" (string) is required.');
      }
      return executeDockerConsoleCommand(request.params.arguments.command);

    case "list_commands":
      // No specific arguments needed for list_commands
      return executeDockerConsoleCommand("list --format=json");

    case "command_help":
      if (!isValidHelpArgs(request.params.arguments)) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for command_help: "commandName" (string) is required.');
      }
      return executeDockerConsoleCommand(`${request.params.arguments.commandName} --help`);

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
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
