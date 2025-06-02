#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
// Define the expected return type for clarity
type ConsoleExecResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

/**
 * Executes a console command either locally or inside a docker container, depending on EXECUTION_MODE.
 * @param commandArgs The arguments to pass to the console command (e.g., "list --format=json").
 * @returns A promise resolving to an object containing stdout, stderr, and the exit code.
 */
const executeConsoleCommand = async (commandArgs: string): Promise<ConsoleExecResult> => {
  // Basic sanitization to prevent command injection vulnerabilities like '; rm -rf /'
  // This is a simple example; more robust sanitization might be needed depending on usage.
  // Adapted from lines 79-81 in the original CallToolRequestSchema handler.
  if (/[;&|`$()]/.test(commandArgs)) {
      throw new McpError(ErrorCode.InvalidParams, 'Invalid characters detected in command arguments.');
  }

  if (!process.env.PATH_CONSOLE) {
    throw new Error('PATH_CONSOLE environment variable is required');
  }

  let fullCommand;
  if (process.env.EXECUTION_MODE === 'local') {
    // Local execution mode
    fullCommand = `${process.env.PATH_CONSOLE} ${commandArgs}`;
  } else {
    // Docker execution mode (default)
    if (!process.env.CONTAINER_NAME) {
      throw new Error('CONTAINER_NAME environment variable is required for docker execution mode');
    }
    fullCommand = `docker exec ${process.env.CONTAINER_NAME} ${process.env.PATH_CONSOLE || '/www/bin/console'} ${commandArgs}`;
  }

  try {
    console.error(`Executing: ${fullCommand}`); // Log the command being executed to server stderr
    const { stdout, stderr } = await execAsync(fullCommand);

    // Always return the object format on success
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    console.error(`Error executing command: ${error}`); // Log the error to server stderr
    // Extract details and return the object format on error
    const stdout = error.stdout || '';
    const stderr = error.stderr || '';
    // Ensure exitCode is a number, default to 1 if not available
    const exitCode = typeof error.code === 'number' ? error.code : 1;
    return { stdout, stderr, exitCode };
  }
};

/**
 * Create an MCP server with capabilities for tools.
 */
const server = new Server(
  {
    name: "docker-console-server",
    version: "0.1.0",
    description: "Executes console commands either locally or inside a docker container. Configured by EXECUTION_MODE (local or docker), CONTAINER_NAME (for docker mode), and PATH_CONSOLE.",
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
        description: `Executes a console command. Current server EXECUTION_MODE: "${process.env.EXECUTION_MODE || 'docker'}". ` +
                     `In "docker" mode, uses container "${process.env.CONTAINER_NAME || '(CONTAINER_NAME not set)'}" and console path "${process.env.PATH_CONSOLE || '/www/bin/console'}". ` +
                     `In "local" mode, executes command directly on the host using "${process.env.PATH_CONSOLE || '(PATH_CONSOLE not set)'}" (PATH_CONSOLE is required for local mode).`,
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
        description: "Lists available console commands (e.g., using `PATH_CONSOLE list --format=json`). Behavior depends on EXECUTION_MODE and PATH_CONSOLE.",
        inputSchema: { type: "object", properties: {} }
      },
      {
        name: "command_help",
        description: "Gets help for a specific console command (e.g., using `PATH_CONSOLE {commandName} --help`). Behavior depends on EXECUTION_MODE and PATH_CONSOLE.",
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
 * Formats the result of executeDockerConsoleCommand into an MCP CallToolResponse.
 * Returns only stdout on clean success (exit code 0, empty stderr),
 * otherwise returns a formatted error message with exit code, stdout, and stderr.
 * @param result The result object from executeDockerConsoleCommand.
 * @returns An MCP tool response object ({ content: ..., isError: ... }).
 */
function formatDockerResultToMcpResponse(result: ConsoleExecResult) { // Updated type to ConsoleExecResult
  if (result.exitCode === 0 && !result.stderr) {
    // Clean success
    return { content: [{ type: "text", text: result.stdout }], isError: false };
  } else {
    // Error or success with stderr
    const message = `Exit Code: ${result.exitCode}\n\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`;
    // Indicate error if exit code is non-zero OR if there's stderr content
    return { content: [{ type: "text", text: message }], isError: true };
  }
}


/**
 * Handler for tool calls.
 * Executes the requested tool based on its name.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => { // Removed explicit return type
  switch (request.params.name) {
    case "execute_console_command": { // Added braces for scope clarity
      if (!isValidExecArgs(request.params.arguments)) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for execute_console_command: "command" (string) is required.');
      }
      const result = await executeConsoleCommand(request.params.arguments.command);
      return formatDockerResultToMcpResponse(result); // Use the helper
    }
    case "list_commands": {
      const result = await executeConsoleCommand("list --format=json");
      // Special handling for JSON parsing on clean success
      if (result.exitCode === 0 && !result.stderr) {
        try {
          JSON.parse(result.stdout); // Validate JSON
          // Return raw stdout for clean, valid JSON output
          return { content: [{ type: "text", text: result.stdout }], isError: false };
        } catch (parseError: any) {
          console.error("Failed to parse list_commands output as JSON:", parseError);
          // Return a specific error if JSON parsing fails on clean output
          const message = `Failed to parse JSON output:\n${parseError.message}\n\nRaw Output:\n${result.stdout}`;
          return { content: [{ type: "text", text: message }], isError: true };
        }
      } else {
        // Handle errors or stderr using the standard helper
        return formatDockerResultToMcpResponse(result);
      }
    }
    case "command_help": { // Added braces for scope clarity
      if (!isValidHelpArgs(request.params.arguments)) {
        throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments for command_help: "commandName" (string) is required.');
      }
      const result = await executeConsoleCommand(`${request.params.arguments.commandName} --help`);
      return formatDockerResultToMcpResponse(result); // Use the helper
    }
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
